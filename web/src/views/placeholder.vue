<template>
  <div class="placeholder">
    <div class="placeholder-emoji">{{ emoji }}</div>
    <h2 class="placeholder-title">{{ title }}</h2>
    <p class="placeholder-text">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const config: Record<string, { emoji: string; title: string; subtitle: string }> = {
  '/reels': {
    emoji: '🎬',
    title: 'Reels',
    subtitle: 'Pronto vas a poder subir y ver videos cortos aquí.',
  },
  '/messages': {
    emoji: '💬',
    title: 'Mensajes',
    subtitle: 'Chat y llamadas con tus amigos. En construcción.',
  },
  '/profile': {
    emoji: '👤',
    title: 'Perfil',
    subtitle: 'Tu perfil, tus transmisiones y ajustes. Muy pronto.',
  },
};

const current = computed(() => config[route.path] || {
  emoji: '✨',
  title: 'Próximamente',
  subtitle: 'Esta sección está en construcción.',
});

const emoji = computed(() => current.value.emoji);
const title = computed(() => current.value.title);
const subtitle = computed(() => current.value.subtitle);
</script>

<style scoped>
.placeholder {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px 32px 90px;
  box-sizing: border-box;
  background: #010101;
  color: #fff;
}
.placeholder-emoji {
  font-size: 56px;
  margin-bottom: 16px;
}
.placeholder-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 800;
}
.placeholder-text {
  margin: 0;
  max-width: 280px;
  font-size: 14px;
  color: #a1a1aa;
  line-height: 1.6;
}
</style>
