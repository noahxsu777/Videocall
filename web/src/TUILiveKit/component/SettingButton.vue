<template>
  <div
    class="custom-icon-container"
    @click="handleCoGuest"
  >
    <IconSetting class="custom-icon" />
    <span class="custom-text setting-text">{{ t('Setting') }}</span>
  </div>
  <TUIDialog
    :custom-classes="['setting-dialog']"
    :title="t('Setting')"
    :visible="coGuestPanelVisible"
    width="400px"
    height="400px"
    @close="coGuestPanelVisible = false"
    @confirm="coGuestPanelVisible = false"
    @cancel="coGuestPanelVisible = false"
  >
    <div class="setting-panel">
      <div class="section">
        <div class="section-title">
          {{ t('Video profile') }}
        </div>
        <div class="row">
          <span class="label">{{ t('Resolution') }}</span>
          <TUISelect
            v-model="publishVideoQuality"
            placeholder="placeholder"
            class="select"
            :teleported="false"
            :popper-append-to-body="false"
            :disabled="isCreatedLive"
          >
            <TUIOption
              v-for="(item, index) in videoQualityList"
              :key="index"
              :label="item.label"
              :value="item.value"
            />
          </TUISelect>
        </div>
      </div>
      <div class="divider" />
      <AudioSettingPanel :output-volume-visible="false" />
    </div>
    <template #footer>
      <div />
    </template>
  </TUIDialog>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { TUIVideoQuality } from '@tencentcloud/tuiroom-engine-js';
import { useUIKit, TUIDialog, TUISelect, TUIOption, IconSetting } from '@tencentcloud/uikit-base-component-vue3';
import { AudioSettingPanel, useVideoMixerState, useLiveListState } from 'tuikit-atomicx-vue3';

const { t } = useUIKit();

const { publishVideoQuality } = useVideoMixerState();
const { currentLive } = useLiveListState();

const isCreatedLive = computed(() => !!currentLive.value?.liveId);

const videoQualityList = computed(() => [
  { label: t('High Definition'), value: TUIVideoQuality.kVideoQuality_720p },
  {
    label: t('Super Definition'),
    value: TUIVideoQuality.kVideoQuality_1080p,
  },
]);

const coGuestPanelVisible = ref(false);

const handleCoGuest = () => {
  coGuestPanelVisible.value = true;
};

defineExpose({ open: handleCoGuest });
</script>

<style lang="scss" scoped>
@import '../style/index.scss';

.custom-icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  width: auto;
  height: 56px;
  cursor: pointer;
  color: $text-color1;
  border-radius: 12px;
  position: relative;

  .unread-count {
    position: absolute;
    top: 0;
    right: 0;
    background-color: var(--text-color-error);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }

  .custom-icon {
    @include icon-size-24;
    background: transparent;
  }
  .custom-text {
    @include text-size-12;
  }

  &:hover {
    box-shadow: 0 0 10px 0 var(--bg-color-mask);
    .custom-icon {
      color: $icon-hover-color;
    }
    .custom-text {
      color: $icon-hover-color;
    }
  }
}

.setting-icon {
  mask-image: url('../icons/setting-icon.svg');
}

// Reskin the Tencent kit's default blue theme with the app's own
// pink→purple brand accent, scoped to this dialog only (every control
// inside — select borders, the "Test" buttons, the volume slider, the
// mic level bars — reads its color off these same CSS custom
// properties, so overriding them here is enough to recolor all of it
// without fighting each control's own stylesheet).
:deep(.setting-dialog) {
  width: 600px;
  --text-color-link: #ff4f8b;
  --text-color-link-hover: #ff699b;
  --text-color-link-active: #e63d78;
  --button-color-primary-default: #ff4f8b;
  --button-color-primary-hover: #ff699b;
  --button-color-primary-active: #e63d78;
  --slider-color-filled: #ff4f8b;
  --bg-color-dialog: #121214;
  --bg-color-dialog-module: #1a1a20;
  --bg-color-operate: rgba(255, 255, 255, 0.06);
  --stroke-color-primary: rgba(255, 255, 255, 0.14);
  --stroke-color-module: rgba(255, 255, 255, 0.28);
  --text-color-primary: #fff;
  --text-color-secondary: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

:deep(.setting-dialog .tui-dialog-header) {
  padding-bottom: 4px;
}

:deep(.setting-dialog .tui-dialog-title) {
  font-size: 18px;
  font-weight: 800;
  background: linear-gradient(90deg, #ff4f8b, #9b2df7);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

:deep(.setting-dialog .select-content) {
  border-radius: 14px !important;
}

:deep(.setting-dialog .tui-button) {
  border-radius: 999px !important;
  font-weight: 700 !important;
}

.setting-panel {
  display: flex;
  flex-direction: column;
  max-height: 600px;
  width: 100%;
  padding: 0 8px;
  overflow: hidden;
  @include scrollbar;
  .section {
    margin-bottom: 32px;

    .section-title {
      position: relative;
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 18px;
      padding-left: 12px;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 2px;
        bottom: 2px;
        width: 3px;
        border-radius: 2px;
        background: linear-gradient(180deg, #ff4f8b, #9b2df7);
      }
    }

    .row {
      display: flex;
      align-items: center;
      margin-bottom: 16px;

      .label {
        width: 96px;
      }
      .select {
        width: 100%;
        font-size: 14px;
      }
    }

    .preview-container {
      margin-top: 8px;

      .video-preview {
        position: relative;
        width: 100%;
        height: 0;
        padding-top: calc(100% * 9 / 16);
        overflow: hidden;
        border-radius: 8px;
        background: #222;
      }
    }
  }
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin-bottom: 32px;
}
</style>
