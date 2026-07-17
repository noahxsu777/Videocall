import { ref } from 'vue';

/**
 * Shared "a route navigation is in flight" flag. The router sets it while
 * a (lazy-loaded) page is resolving; App.vue shows a top progress bar so
 * tapping Reels / Mensajes / Perfil gives instant feedback instead of a
 * frozen tap.
 */
export const navLoading = ref(false);

/**
 * Bumping this key is used by App.vue as the <router-view> key, so a
 * pull-to-refresh re-mounts the CURRENT page (re-running its data load
 * with the nice AppLoader) WITHOUT a full window.location.reload() — that
 * full reload is what flashed a black page. The app stays on screen the
 * whole time.
 */
export const refreshKey = ref(0);

export function softRefresh(): void {
  refreshKey.value += 1;
}
