import { ref } from 'vue';

/**
 * Shared "a route navigation is in flight" flag. The router sets it while
 * a (lazy-loaded) page is resolving; App.vue shows a top progress bar so
 * tapping Reels / Mensajes / Perfil gives instant feedback instead of a
 * frozen tap.
 */
export const navLoading = ref(false);
