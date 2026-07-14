<template>
  <transition name="splash-fade">
    <div v-if="visible" class="splash-screen">
      <video
        class="splash-video"
        :src="splashSrc"
        autoplay
        muted
        playsinline
        preload="auto"
        @ended="dismiss"
        @error="dismiss"
      />
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// Bound dynamically (":src", not a static "src=") on purpose — Vue's
// template compiler would otherwise try to resolve a literal
// `src="./splash.mp4"` as a bundled module import, which fails because
// the file lives in public/ (served as-is, not bundled).
const splashSrc = `${import.meta.env.BASE_URL}splash.mp4`;

const visible = ref(true);
let dismissed = false;

function dismiss() {
  if (dismissed) {
    return;
  }
  dismissed = true;
  visible.value = false;
}

onMounted(() => {
  // Safety net: never block the app for more than a few seconds, even if
  // the video fails to autoplay (some browsers restrict autoplay in
  // edge cases) or runs longer than expected.
  window.setTimeout(dismiss, 4500);
});
</script>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Matches manifest.webmanifest's background_color/theme_color so the
     handoff from the OS-generated native splash (Android/iOS can only
     show a static color + icon, never video) into this video is
     seamless instead of a jarring color flash. */
  background: #0d0718;
}
.splash-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.splash-fade-leave-active {
  transition: opacity 0.4s ease;
}
.splash-fade-leave-to {
  opacity: 0;
}
</style>
