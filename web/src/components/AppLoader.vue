<template>
  <div class="app-loader">
    <div class="al-orb">
      <span class="al-ring" />
      <span class="al-ring al-ring-2" />
      <span class="al-core" />
    </div>
    <span class="al-label">{{ label || 'Cargando…' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label?: string }>();
</script>

<style scoped>
.app-loader {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  /* Never a flat black — the app's ambient gradient shows while loading. */
  background: radial-gradient(120% 90% at 50% 0%, #2a153f 0%, #170d28 45%, #0d0718 100%);
}

.al-orb {
  position: relative;
  width: 62px;
  height: 62px;
}
.al-ring,
.al-ring-2 {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid transparent;
}
.al-ring {
  border-top-color: #ff2e74;
  border-right-color: #ff2e74;
  animation: al-spin 0.9s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite;
}
.al-ring-2 {
  inset: 9px;
  border-top-color: #8b3dff;
  border-left-color: #8b3dff;
  animation: al-spin 1.3s linear infinite reverse;
}
.al-core {
  position: absolute;
  inset: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  animation: al-pulse 1.2s ease-in-out infinite;
  box-shadow: 0 0 22px rgba(255, 46, 116, 0.55);
}
@keyframes al-spin {
  to { transform: rotate(360deg); }
}
@keyframes al-pulse {
  0%, 100% { transform: scale(0.75); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
}

.al-label {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: #b3a9cf;
  animation: al-fade 1.4s ease-in-out infinite;
}
@keyframes al-fade {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
