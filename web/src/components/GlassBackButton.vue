<template>
  <button class="glass-btn" type="button" aria-label="Atrás">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg>
  </button>
</template>

<script setup lang="ts">
// iOS 26 "liquid glass" back button — translucent capsule with a top
// specular highlight and a slow water-like shimmer sweeping across.
// Native click events fall through to the parent automatically.
</script>

<style scoped>
.glass-btn {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border: none;
  cursor: pointer;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.09);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  backdrop-filter: blur(18px) saturate(180%);
  /* Edge lighting: bright top rim, soft sides, depth below */
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.4),
    inset 0 -1px 1px rgba(255, 255, 255, 0.12),
    inset 1px 0 1px rgba(255, 255, 255, 0.12),
    inset -1px 0 1px rgba(255, 255, 255, 0.12),
    0 8px 20px rgba(0, 0, 0, 0.35);
  transition: transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

/* Static specular gradient (glass curvature) */
.glass-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    115deg,
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0) 32%,
    rgba(255, 255, 255, 0) 68%,
    rgba(255, 255, 255, 0.16) 100%
  );
  pointer-events: none;
}

/* Water shimmer sweeping across every few seconds */
.glass-btn::after {
  content: '';
  position: absolute;
  top: -60%;
  left: -90%;
  width: 55%;
  height: 220%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: rotate(18deg);
  animation: glass-water 3.8s ease-in-out infinite;
  pointer-events: none;
}
@keyframes glass-water {
  0% { left: -90%; }
  55% { left: 140%; }
  100% { left: 140%; }
}

.glass-btn:active {
  transform: scale(0.92);
}

.glass-btn svg {
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
}
</style>
