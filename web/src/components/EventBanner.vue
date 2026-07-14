<template>
  <button class="event-banner" :style="{ background }" @click="$emit('click')">
    <span class="eb-glow" />
    <span class="eb-shine" />
    <span class="eb-icon">{{ icon }}</span>
    <span class="eb-text">
      <span class="eb-title">{{ title }}</span>
      <span v-if="subtitle" class="eb-subtitle">{{ subtitle }}</span>
    </span>
    <span class="eb-cta">{{ cta }}</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string;
    title: string;
    subtitle?: string;
    cta?: string;
    background?: string;
  }>(),
  {
    icon: '👑',
    subtitle: '',
    cta: 'Ver',
    background: 'linear-gradient(120deg, #3a2405 0%, #6b3f00 45%, #1a1204 100%)',
  },
);
defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.event-banner {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 8px 22px rgba(0, 0, 0, 0.35);
  -webkit-tap-highlight-color: transparent;
}
.event-banner:active {
  transform: scale(0.985);
}

/* Ambient glow blob drifting behind the content */
.eb-glow {
  position: absolute;
  top: -40%;
  left: 60%;
  width: 70%;
  height: 180%;
  background: radial-gradient(circle, rgba(255, 215, 120, 0.35), transparent 70%);
  animation: eb-drift 6s ease-in-out infinite;
  pointer-events: none;
}
@keyframes eb-drift {
  0%, 100% { transform: translateX(0) scale(1); }
  50% { transform: translateX(-14%) scale(1.15); }
}

/* Water-glass shimmer sweep */
.eb-shine {
  position: absolute;
  top: -60%;
  left: -40%;
  width: 35%;
  height: 220%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.22), transparent);
  transform: rotate(18deg);
  animation: eb-shine-sweep 4.2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes eb-shine-sweep {
  0% { left: -40%; }
  60% { left: 130%; }
  100% { left: 130%; }
}

.eb-icon {
  position: relative;
  z-index: 1;
  font-size: 30px;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4));
}
.eb-text {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  text-align: left;
}
.eb-title {
  font-size: 14.5px;
  font-weight: 800;
  color: #fff;
  line-height: 1.25;
}
.eb-subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eb-cta {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
}
</style>
