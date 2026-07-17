<template>
  <div
    v-show="distance > 0 || refreshing"
    class="ptr"
    :style="{ transform: `translateX(-50%) translateY(${indicatorY}px)` }"
  >
    <div class="ptr-circle" :class="{ ready, refreshing }" :style="circleStyle">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v5h-5" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const THRESHOLD = 72; // pull distance (px, after damping) that triggers a refresh
const MAX = 120;

const distance = ref(0);
const refreshing = ref(false);

let startY = 0;
let pulling = false;
let scroller: HTMLElement | null = null;

const ready = computed(() => distance.value >= THRESHOLD);
const indicatorY = computed(() => (refreshing.value ? 64 : distance.value));
const circleStyle = computed(() => {
  if (refreshing.value) {
    return {};
  }
  const progress = Math.min(1, distance.value / THRESHOLD);
  return {
    transform: `rotate(${distance.value * 2.6}deg) scale(${0.6 + progress * 0.4})`,
    opacity: String(Math.min(1, progress + 0.2)),
  };
});

function findScroller(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function onTouchStart(e: TouchEvent) {
  if (refreshing.value || e.touches.length !== 1) {
    pulling = false;
    return;
  }
  scroller = findScroller(e.target as HTMLElement);
  // Only arm the gesture if the scroll container (or the viewport) is
  // already scrolled to the very top — otherwise this is a normal scroll.
  const atTop = !scroller || scroller.scrollTop <= 0;
  if (atTop) {
    startY = e.touches[0].clientY;
    pulling = true;
    distance.value = 0;
  } else {
    pulling = false;
  }
}

function onTouchMove(e: TouchEvent) {
  if (!pulling || refreshing.value) {
    return;
  }
  // Bail if the container got scrolled off the top mid-gesture.
  if (scroller && scroller.scrollTop > 0) {
    pulling = false;
    distance.value = 0;
    return;
  }
  const dy = e.touches[0].clientY - startY;
  if (dy <= 0) {
    distance.value = 0;
    return;
  }
  // Rubber-band damping so it feels elastic, not 1:1.
  distance.value = Math.min(dy * 0.5, MAX);
}

function onTouchEnd() {
  if (!pulling) {
    return;
  }
  pulling = false;
  if (distance.value >= THRESHOLD) {
    refreshing.value = true;
    // Let the spin animation show for a beat, then reload.
    window.setTimeout(() => window.location.reload(), 700);
  } else {
    distance.value = 0;
  }
}

onMounted(() => {
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
});
onUnmounted(() => {
  window.removeEventListener('touchstart', onTouchStart);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
  window.removeEventListener('touchcancel', onTouchEnd);
});
</script>

<style scoped>
.ptr {
  position: fixed;
  top: 4px;
  left: 50%;
  z-index: 4000;
  pointer-events: none;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.ptr-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  box-shadow: 0 6px 18px rgba(155, 45, 247, 0.5);
}
.ptr-circle.ready {
  box-shadow: 0 6px 22px rgba(255, 46, 116, 0.7);
}
.ptr-circle.refreshing {
  animation: ptr-spin 0.7s linear infinite;
  opacity: 1;
}
@keyframes ptr-spin {
  to { transform: rotate(360deg); }
}
</style>
