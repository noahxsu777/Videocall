<template>
  <div class="reels-sk">
    <!-- The video area -->
    <div class="sk sk-media" />

    <!-- Right action rail (like / comment / share / more) -->
    <div class="sk-rail">
      <div v-for="n in 4" :key="n" class="sk sk-circle" />
    </div>

    <!-- Author + caption at the bottom -->
    <div class="sk-bottom">
      <div class="sk-author">
        <div class="sk sk-avatar" />
        <div class="sk sk-line sk-name" />
      </div>
      <div class="sk sk-line sk-cap-1" />
      <div class="sk sk-line sk-cap-2" />
    </div>
  </div>
</template>

<style scoped>
.reels-sk {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: #0a0a0c;
  overflow: hidden;
}

/* Shimmer base — a dark block with a highlight sweeping across it. */
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

.sk-media {
  position: absolute;
  inset: 0;
  border-radius: 0;
}

.sk-rail {
  position: absolute;
  right: 12px;
  bottom: 120px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.sk-circle { width: 38px; height: 38px; border-radius: 50%; }

.sk-bottom {
  position: absolute;
  left: 14px;
  right: 80px;
  bottom: 92px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sk-author { display: flex; align-items: center; gap: 10px; }
.sk-avatar { width: 34px; height: 34px; border-radius: 50%; }
.sk-line { height: 12px; border-radius: 6px; }
.sk-name { width: 120px; }
.sk-cap-1 { width: 80%; }
.sk-cap-2 { width: 55%; }
</style>
