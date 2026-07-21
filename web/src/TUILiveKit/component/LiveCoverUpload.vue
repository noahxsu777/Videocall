<template>
  <div class="live-cover-upload">
    <input
      ref="coverFileInputRef"
      class="cover-file-input"
      type="file"
      :accept="acceptedCoverFileTypes"
      @change="handleCoverFileChange"
    >
    <div
      v-if="uploadEnabled"
      class="cover-card"
      :class="{ filled: hasCover }"
      @click="handleCardClick"
      @dragover.prevent="handleDragOver"
      @drop.prevent="handleDrop"
    >
      <img
        v-if="hasCover"
        class="cover-preview-image"
        :src="coverUrlModel"
        alt="cover preview"
      >
      <div v-else class="cover-placeholder">
        <div class="cover-placeholder-title">{{ t('Click to upload cover image') }}</div>
      </div>
      <button
        v-if="hasCover"
        class="cover-remove-btn"
        type="button"
        :title="t('Remove cover')"
        @click.stop="handleRemoveCover"
      >
        <IconClose :size="12" />
      </button>
    </div>

    <div class="cover-tip">{{ coverUploadHint }}</div>

    <template v-if="!uploadEnabled">
      <TUIInput
        v-model="coverUrlModel"
        :placeholder="t('Cover URL')"
        :spellcheck="false"
      />
      <div class="cover-tip cover-tip-warning">
        {{ t('Upload is unavailable. Please enter cover URL manually') }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IconClose, TUIInput, TUIToast, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import {
  UPLOAD_ALLOWED_MIME_TYPES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../../api/upload';
import { uploadCover } from '../../data/profiles';
import { useAuth } from '../../auth/useAuth';

const LANDSCAPE_COVER_RATIO = 16 / 9;
const PORTRAIT_COVER_RATIO = 9 / 16;

type CoverType = 'landscape' | 'portrait';

const props = withDefaults(defineProps<{
  modelValue?: string;
  uploadEnabled?: boolean;
  maxSizeMb?: number;
  allowedMimeTypes?: string[];
  coverType?: CoverType;
}>(), {
  modelValue: '',
  uploadEnabled: false,
  maxSizeMb: UPLOAD_MAX_FILE_SIZE_MB,
  coverType: 'landscape',
  allowedMimeTypes: () => [...UPLOAD_ALLOWED_MIME_TYPES],
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'update:coverType', value: CoverType): void;
  (event: 'upload-success', payload: { url: string }): void;
}>();

const { t } = useUIKit();
const { user } = useAuth();
const coverFileInputRef = ref<HTMLInputElement>();
const isUploading = ref(false);
const detectCoverTypeTaskId = ref(0);

const coverUrlModel = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});
const acceptedCoverFileTypes = computed(() => props.allowedMimeTypes.join(','));
const uploadEnabled = computed(() => props.uploadEnabled);
const coverUploadHint = computed(() =>
  t('File size cannot exceed {size}MB')
    .replace('{size}', String(props.maxSizeMb))
);
const hasCover = computed(() => !!props.modelValue);

function parseUploadErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || t('Upload failed, please try again');
}

function resolveCoverTypeByRatio(width: number, height: number): CoverType {
  const ratio = width / height;
  const landscapeDiff = Math.abs(ratio - LANDSCAPE_COVER_RATIO);
  const portraitDiff = Math.abs(ratio - PORTRAIT_COVER_RATIO);
  return landscapeDiff <= portraitDiff ? 'landscape' : 'portrait';
}

async function detectCoverTypeFromUrl(url: string): Promise<CoverType | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        resolve(null);
        return;
      }
      resolve(resolveCoverTypeByRatio(width, height));
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function getImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
      URL.revokeObjectURL(imageUrl);
    };
    image.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(imageUrl);
    };
    image.src = imageUrl;
  });
}

function showUploadUnavailableTip() {
  TUIToast.info({
    message: t('Upload is unavailable. Please enter cover URL manually'),
  });
}

function triggerFileSelect() {
  coverFileInputRef.value?.click();
}

function handleCardClick() {
  if (isUploading.value) {
    return;
  }
  if (!props.uploadEnabled) {
    showUploadUnavailableTip();
    return;
  }
  triggerFileSelect();
}

function handleDragOver(event: DragEvent) {
  if (!props.uploadEnabled && event.dataTransfer) {
    event.dataTransfer.dropEffect = 'none';
  }
}

async function handleDrop(event: DragEvent) {
  if (isUploading.value) {
    return;
  }
  if (!props.uploadEnabled) {
    showUploadUnavailableTip();
    return;
  }
  const selectedFile = event.dataTransfer?.files?.[0];
  if (!selectedFile) {
    return;
  }
  await processUploadFile(selectedFile);
}

async function processUploadFile(selectedFile: File) {
  try {
    // Only the format matters now — we accept any photo from the gallery,
    // compress it client-side and upload it to Supabase Storage. We no
    // longer reject on a strict 16:9 / 9:16 ratio (that blocked most real
    // photos); instead we auto-detect which frame the image best fits.
    if (!props.allowedMimeTypes.includes(selectedFile.type)) {
      TUIToast.error({ message: t('Unsupported image format') });
      return;
    }
    if (!user.value?.id) {
      TUIToast.error({ message: t('Please log in first') });
      return;
    }

    isUploading.value = true;

    let finalType: CoverType = 'landscape';
    try {
      const { width, height } = await getImageSize(selectedFile);
      finalType = resolveCoverTypeByRatio(width, height);
    } catch {
      // couldn't read dimensions — keep the default
    }

    const url = await uploadCover(user.value.id, selectedFile);
    if (props.coverType !== finalType) {
      emit('update:coverType', finalType);
    }
    emit('update:modelValue', url);
    emit('upload-success', { url });
  } catch (error: unknown) {
    TUIToast.error({
      message: parseUploadErrorMessage(error),
    });
  } finally {
    isUploading.value = false;
  }
}

async function handleCoverFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selectedFile = input.files?.[0];
  input.value = '';
  if (!selectedFile || isUploading.value) {
    return;
  }
  await processUploadFile(selectedFile);
}

function handleRemoveCover() {
  emit('update:modelValue', '');
}

async function syncCoverTypeByCoverUrl(coverUrl: string) {
  const taskId = ++detectCoverTypeTaskId.value;
  const detectedType = await detectCoverTypeFromUrl(coverUrl);
  if (!detectedType || taskId !== detectCoverTypeTaskId.value) {
    return;
  }
  if (detectedType !== props.coverType) {
    emit('update:coverType', detectedType);
  }
}

watch(
  [() => props.modelValue, () => props.coverType],
  ([nextCoverUrl, nextCoverType], [prevCoverUrl, prevCoverType]) => {
    if (!nextCoverUrl) {
      detectCoverTypeTaskId.value += 1;
      return;
    }
    const isInitialRun = prevCoverUrl === undefined || prevCoverType === undefined;
    const coverUrlChangedFromEmpty = !prevCoverUrl && !!nextCoverUrl;
    const coverTypeChanged = nextCoverType !== prevCoverType;
    if (!isInitialRun && !coverUrlChangedFromEmpty && !coverTypeChanged) {
      return;
    }
    void syncCoverTypeByCoverUrl(nextCoverUrl);
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
@import '../style/index.scss';

.live-cover-upload {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cover-file-input {
  display: none;
}

.cover-card {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 150px;
  border-radius: 14px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: border-color .2s ease;
}

.cover-card:hover {
  border-color: rgba(255, 255, 255, 0.32);
}

.cover-card.filled {
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.14);
}

.cover-preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  text-align: center;
}

.cover-placeholder-title {
  @include text-size-12;
  width: 100%;
  line-height: 16px;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  color: $text-color2;
}

.cover-remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
}

.cover-tip {
  @include text-size-12;
  color: $text-color2;
}

.cover-tip-warning {
  color: var(--text-color-warning, #ff9c3e);
}
</style>
