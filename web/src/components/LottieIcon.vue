<template>
  <canvas ref="canvasEl" :width="size" :height="size" class="lottie-icon" :style="{ width: size + 'px', height: size + 'px' }" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { DotLottie } from '@lottiefiles/dotlottie-web';

const props = withDefaults(defineProps<{ src: string; size?: number }>(), {
  size: 40,
});

const canvasEl = ref<HTMLCanvasElement | null>(null);
let player: DotLottie | null = null;

function create() {
  if (!canvasEl.value) {
    return;
  }
  player?.destroy();
  player = new DotLottie({
    canvas: canvasEl.value,
    src: props.src,
    autoplay: true,
    loop: true,
  });
}

onMounted(create);
watch(() => props.src, create);

onUnmounted(() => {
  player?.destroy();
  player = null;
});
</script>

<style scoped>
.lottie-icon {
  display: block;
  pointer-events: none;
}
</style>
