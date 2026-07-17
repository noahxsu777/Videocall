<template>
  <div
    class="device-btn"
    :class="{ 'is-muted': !speakerIsOn }"
    @click="switchSpeaker(!speakerIsOn)"
  >
    <TUIIcon
      class="device-icon"
      :icon="speakerIsOn ? IconSpeakerOn : IconSpeakerOff"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { TUIIcon, IconSpeakerOn, IconSpeakerOff } from '@tencentcloud/uikit-base-component-vue3';
import { useDeviceState } from 'tuikit-atomicx-vue3';

const { outputVolume, setOutputVolume } = useDeviceState();

const DEFAULT_VOLUME = 100;
const speakerIsOn = ref(true);
const speakerVolumeBeforeMute = ref(outputVolume.value || DEFAULT_VOLUME);

const switchSpeaker = (open: boolean) => {
  speakerIsOn.value = open;
  if (!open) {
    speakerVolumeBeforeMute.value = outputVolume.value || DEFAULT_VOLUME;
    setOutputVolume(0);
  } else {
    setOutputVolume(speakerVolumeBeforeMute.value || DEFAULT_VOLUME);
  }
};
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

  .device-icon {
    width: 22px;
    height: 22px;
  }
  &.is-muted {
    background: rgba(220, 53, 69, 0.6);
  }
  &:active {
    transform: scale(0.92);
  }
}
</style>
