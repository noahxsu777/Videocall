import { ref } from 'vue';

// True when a NEW app version has been installed by the service worker
// while this session is open — App.vue shows the "Actualizar" pill, and
// tapping it reloads once to pick the fresh code up. (We never reload
// automatically: that caused the double-load black flash.)
export const updateAvailable = ref(false);
