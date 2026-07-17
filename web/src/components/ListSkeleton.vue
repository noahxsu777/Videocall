<template>
  <div class="list-sk">
    <div v-for="n in rows" :key="n" class="list-sk-row">
      <div class="sk sk-avatar" />
      <div class="sk-lines">
        <div class="sk sk-line sk-w55" />
        <div class="sk sk-line sk-w75" />
      </div>
      <div class="sk sk-time" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 8 });
</script>

<style scoped>
.list-sk { padding: 8px 14px; }
.list-sk-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 2px;
}

.sk {
  position: relative;
  overflow: hidden;
  background: #15151b;
  border-radius: 8px;
}
.sk::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.07) 40%,
    rgba(255, 255, 255, 0.11) 50%,
    rgba(255, 255, 255, 0.07) 60%,
    transparent
  );
  animation: sk-shimmer 1.25s ease-in-out infinite;
}
@keyframes sk-shimmer {
  100% { transform: translateX(100%); }
}

.sk-avatar { width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; }
.sk-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.sk-line { height: 12px; border-radius: 6px; }
.sk-w55 { width: 55%; }
.sk-w75 { width: 75%; }
.sk-time { width: 34px; height: 10px; border-radius: 5px; flex-shrink: 0; }
</style>
