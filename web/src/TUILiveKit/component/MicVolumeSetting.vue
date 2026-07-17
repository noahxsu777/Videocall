<template>
  <div
    class="device-btn"
    :class="{ 'is-muted': microphoneStatus === DeviceStatus.Off }"
    @click="switchMicrophoneStatus"
  >
    <AudioIcon
      :size="20"
      :audio-volume="currentMicVolume"
      :is-muted="microphoneStatus === DeviceStatus.Off"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { TUIToast, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { DeviceError, DeviceStatus, useDeviceState } from 'tuikit-atomicx-vue3';
import AudioIcon from '../base-component/AudioIcon.vue';

const { t } = useUIKit();

const {
  setCaptureVolume,
  microphoneStatus,
  muteLocalAudio,
  unmuteLocalAudio,
  openLocalMicrophone,
  microphoneLastError,
  currentMicVolume,
} = useDeviceState();

const DEFAULT_VOLUME = 100;

// User-intended capture volume. Persisted at MODULE scope (not component
// scope) so that it survives MicVolumeSetting's unmount/remount cycle
// across "end live -> back to list -> start live again". Stored value is
// ALWAYS a non-zero number in [1, 100] — it represents what the user wants
// when the mic is on. Muting the mic does NOT overwrite this value, only
// sets the SDK captureVolume to 0 while leaving `intendedVolume` intact.
//
// Why module-scope: in the previous implementation `microphoneVolumeBeforeMute`
// was a component ref initialized from `captureVolume.value`. Because
// `captureVolume` (module-scope ref in DeviceState) got written to 0 during
// the first live session, on remount the component read 0 back, effectively
// losing the user's intended volume and causing the second-time-open
// "observers hear nothing" regression.
const intendedVolume = ref(DEFAULT_VOLUME);

const switchMicrophoneStatus = async () => {
  if (microphoneLastError.value !== DeviceError.NoError) {
    switch (microphoneLastError.value) {
      case DeviceError.NoDeviceDetected:
        TUIToast.error({
          message: t('No device detected'),
        });
        break;
      case DeviceError.NoSystemPermission:
        TUIToast.error({
          message: t('No system permission'),
        });
        break;
      case DeviceError.NotSupportCapture:
        TUIToast.error({
          message: t('Not support capture'),
        });
        break;
      default:
        break;
    }
  }
  if (microphoneStatus.value === DeviceStatus.On) {
    // Mute without touching `intendedVolume`.
    await muteLocalAudio();
    await setCaptureVolume(0);
  } else {
    // Unmute and restore the user's intended volume.
    try {
      await openLocalMicrophone();
      await unmuteLocalAudio();
    } catch (err) {
      console.warn('[MicVolumeSetting] openLocalMicrophone failed:', err);
    }
    await setCaptureVolume(intendedVolume.value || DEFAULT_VOLUME);
  }
};

// When the mic transitions from Off -> On (e.g. triggered by LivePusherView's
// `openLocalMicrophone` after startLive success, or by any other code path),
// defensively re-apply the user's intended volume to the SDK. This protects
// against trtc-sdk-v5 inheriting a stale captureVolume=0 from a previous
// stopLocalAudio, which would otherwise silence the host on second-time-open.
watch(microphoneStatus, (next, prev) => {
  if (next === DeviceStatus.On && prev === DeviceStatus.Off) {
    const volume = intendedVolume.value || DEFAULT_VOLUME;
    setCaptureVolume(volume);
  }
});
</script>

<style lang="scss" scoped>
@import '../style/index.scss';

.device-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.4);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  -webkit-tap-highlight-color: transparent;

  &.is-muted {
    background: rgba(220, 53, 69, 0.6);
  }
  &:active {
    transform: scale(0.92);
  }
}
</style>
