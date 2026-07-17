<template>
  <div class="settings">
    <header class="nav">
      <GlassBackButton @click="router.back()" />
      <span class="nav-title">Ajustes</span>
      <span class="nav-spacer" />
    </header>

    <div class="content">
      <!-- Editar perfil -->
      <p class="group-header">Editar perfil</p>
      <section class="group">
        <div class="row row-input">
          <span class="row-key">Usuario</span>
          <input
            v-model.trim="username"
            class="row-field"
            type="text"
            maxlength="24"
            placeholder="tunombre"
            :disabled="!canChangeName"
          />
        </div>
        <div class="row row-input row-textarea">
          <span class="row-key">Bio</span>
          <textarea v-model.trim="bio" class="row-field" maxlength="160" rows="2" placeholder="Cuéntanos sobre ti" />
        </div>
      </section>
      <p class="group-footer" :class="{ locked: !canChangeName }">
        <template v-if="canChangeName">
          Tu usuario se ve en tus lives y perfil. Solo puedes cambiarlo cada 30 días.
        </template>
        <template v-else>
          🔒 Podrás cambiar tu usuario en {{ daysLeft }} {{ daysLeft === 1 ? 'día' : 'días' }}.
        </template>
      </p>

      <p v-if="saveMsg" class="save-msg" :class="saveOk ? 'ok' : 'err'">{{ saveMsg }}</p>
      <button class="save-btn" :disabled="saving" @click="save">
        <span v-if="saving" class="spinner" />
        <span v-else>Guardar cambios</span>
      </button>

      <!-- Cuenta -->
      <p class="group-header">Cuenta</p>
      <section class="group">
        <div class="row">
          <span class="row-key">Correo</span>
          <span class="row-val">{{ user?.email || '—' }}</span>
        </div>
        <div class="row">
          <span class="row-key">ID de usuario</span>
          <span class="row-val mono">{{ shortId }}</span>
        </div>
      </section>

      <!-- VIP -->
      <p class="group-header">Membresía</p>
      <section class="group">
        <button class="row row-tap" @click="router.push('/vip')">
          <span class="ic ic-vip">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M3 7l4 3 5-6 5 6 4-3-2 12H5L3 7z"/></svg>
          </span>
          <span class="row-key">{{ vipActive ? 'VIP activo' : 'Comprar VIP' }}</span>
          <span class="row-val vip-val">{{ vipActive ? vipUntilText : '👑' }}</span>
          <span class="chev" v-html="CHEV" />
        </button>
        <button class="row row-tap" @click="router.push('/verified')">
          <span class="ic ic-verified">
            <VerifiedBadge :size="16" />
          </span>
          <span class="row-key">{{ verified ? 'Cuenta verificada' : 'Obtener verificación' }}</span>
          <span class="row-val verified-val">{{ verified ? '✓' : '🪙' }}</span>
          <span class="chev" v-html="CHEV" />
        </button>
        <button class="row row-tap" @click="router.push('/become-creator')">
          <span class="ic ic-creator">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z"/></svg>
          </span>
          <span class="row-key">{{ isCreator ? 'Eres Creador' : 'Conviértete en Creador' }}</span>
          <span class="row-val creator-val">{{ isCreator ? '✓' : '🎥' }}</span>
          <span class="chev" v-html="CHEV" />
        </button>
      </section>

      <!-- Herramientas del creador (debajo de Membresía) -->
      <p class="group-header">Herramientas del creador</p>
      <section class="group">
        <button class="row row-tap" @click="router.push('/live-pusher')">
          <span class="ic ic-camera">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/></svg>
          </span>
          <span class="row-key">Mi cámara</span>
          <span class="chev" v-html="CHEV" />
        </button>
        <button class="row row-tap" @click="router.push('/vip')">
          <span class="ic ic-money">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 2.5-5 1.5-5 4a2.5 2 0 0 0 5 0"/></svg>
          </span>
          <span class="row-key">Obtener dinero</span>
          <span class="row-dot" />
          <span class="chev" v-html="CHEV" />
        </button>
        <button class="row row-tap" @click="notImplemented">
          <span class="ic ic-stats">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
          </span>
          <span class="row-key">Estadísticas</span>
          <span class="chev" v-html="CHEV" />
        </button>
        <button class="row row-tap" @click="router.push('/fan-club')">
          <span class="ic ic-fans">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
          </span>
          <span class="row-key">Club de Fans</span>
          <span class="chev" v-html="CHEV" />
        </button>
      </section>

      <!-- Programas especiales -->
      <p class="group-header">Programas especiales</p>
      <section class="group">
        <button class="row row-tap" @click="router.push('/agency')">
          <span class="ic ic-agency">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 20a5 5 0 0 1 6 0"/></svg>
          </span>
          <span class="row-key">Programa para agencias</span>
          <span class="chev" v-html="CHEV" />
        </button>
        <button class="row row-tap" @click="notImplemented">
          <span class="ic ic-intro">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/></svg>
          </span>
          <span class="row-key">Introducción</span>
          <span class="chev" v-html="CHEV" />
        </button>
        <button class="row row-tap" @click="notImplemented">
          <span class="ic ic-games">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 14h.01"/></svg>
          </span>
          <span class="row-key">Juegos</span>
          <span class="chev" v-html="CHEV" />
        </button>
      </section>

      <!-- Administración (solo visible para cuentas admin) -->
      <template v-if="isAdminUser">
        <p class="group-header">Administración</p>
        <section class="group">
          <button class="row row-tap" @click="router.push('/admin')">
            <span class="ic ic-admin">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z"/></svg>
            </span>
            <span class="row-key">Panel de administración</span>
            <span class="chev" v-html="CHEV" />
          </button>
        </section>
      </template>

      <!-- Preferencias -->
      <p class="group-header">Preferencias</p>
      <section class="group">
        <button class="row row-tap" @click="notImplemented">
          <span class="ic ic-bell">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6-1.6-1.6V10a5.4 5.4 0 0 0-4-5.2V4a1.4 1.4 0 1 0-2.8 0v.8A5.4 5.4 0 0 0 6.6 10v4.4L5 16a1 1 0 0 0 .7 1.7h12.6A1 1 0 0 0 19 16Z"/></svg>
          </span>
          <span class="row-key">Notificaciones</span>
          <span class="chev" v-html="CHEV" />
        </button>
        <button class="row row-tap" @click="notImplemented">
          <span class="ic ic-lock">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M17 9V7a5 5 0 0 0-10 0v2a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM9 7a3 3 0 0 1 6 0v2H9Z"/></svg>
          </span>
          <span class="row-key">Privacidad</span>
          <span class="chev" v-html="CHEV" />
        </button>
        <div class="row">
          <span class="ic ic-moon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
          </span>
          <span class="row-key">Tema oscuro</span>
          <button class="switch" :class="{ on: darkTheme }" @click="darkTheme = !darkTheme">
            <span class="knob" />
          </button>
        </div>
      </section>

      <!-- Acerca de -->
      <p class="group-header">Acerca de</p>
      <section class="group">
        <div class="row">
          <span class="row-key">Versión</span>
          <span class="row-val">1.0.0</span>
        </div>
        <button class="row row-tap" @click="notImplemented">
          <span class="row-key">Términos y privacidad</span>
          <span class="chev" v-html="CHEV" />
        </button>
      </section>

      <p v-if="infoMsg" class="info-msg">{{ infoMsg }}</p>

      <!-- Cerrar sesión -->
      <section class="group">
        <button class="row row-tap row-danger" @click="handleLogout">
          <span class="row-key">Cerrar sesión</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import TUIRoomEngine from '@tencentcloud/tuiroom-engine-js';
import GlassBackButton from '../components/GlassBackButton.vue';
import VerifiedBadge from '../components/VerifiedBadge.vue';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../auth/supabase';
import {
  getProfile,
  ensureProfile,
  updateProfile,
  updateDisplayName,
  daysUntilNameChange,
  isVipActive,
} from '../data/profiles';

const router = useRouter();
const { user, displayName, logout } = useAuth();

const CHEV =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

const username = ref('');
const bio = ref('');
const originalName = ref('');
const nameUpdatedAt = ref<string | null>(null);
const saving = ref(false);
const saveMsg = ref('');
const saveOk = ref(false);
const infoMsg = ref('');
const darkTheme = ref(true);
const vipUntil = ref<string | null>(null);
const verified = ref(false);
const isCreator = ref(false);
const isAdminUser = ref(false);
const avatarUrl = ref('');

const shortId = computed(() => (user.value?.id || '').slice(0, 8) || '—');
const daysLeft = computed(() => daysUntilNameChange(nameUpdatedAt.value));
const canChangeName = computed(() => daysLeft.value === 0);
const vipActive = computed(() => isVipActive(vipUntil.value));
const vipUntilText = computed(() =>
  vipUntil.value ? new Date(vipUntil.value).toLocaleDateString() : '');

onMounted(async () => {
  if (!user.value) {
    return;
  }
  try {
    await ensureProfile(user.value.id, displayName.value);
    const p = await getProfile(user.value.id);
    const name = p?.display_name || p?.username || displayName.value;
    username.value = name;
    originalName.value = name;
    bio.value = p?.bio || '';
    nameUpdatedAt.value = p?.name_updated_at || null;
    vipUntil.value = p?.vip_until || null;
    verified.value = !!p?.verified;
    isCreator.value = !!p?.is_creator;
    isAdminUser.value = !!p?.is_admin;
    avatarUrl.value = p?.avatar_url || '';
  } catch (error) {
    console.error('[settings] load failed:', error);
    username.value = displayName.value;
    originalName.value = displayName.value;
  }
});

async function save() {
  if (!user.value) {
    return;
  }
  saveMsg.value = '';
  const newName = username.value.trim();
  const nameChanged = newName && newName !== originalName.value;

  if (nameChanged && !canChangeName.value) {
    saveOk.value = false;
    saveMsg.value = `Solo puedes cambiar tu usuario cada 30 días. Espera ${daysLeft.value} días.`;
    return;
  }

  saving.value = true;
  try {
    await updateProfile(user.value.id, { bio: bio.value || '' });

    if (nameChanged) {
      await updateDisplayName(user.value.id, newName);
      await supabase?.auth.updateUser({ data: { display_name: newName } });
      try {
        // Keep the current avatar — passing '' here used to wipe it, so
        // after any name change the user showed up as the default
        // silhouette in lives.
        await TUIRoomEngine.setSelfInfo({ userName: newName, avatarUrl: avatarUrl.value || '' });
      } catch (error) {
        console.warn('[settings] setSelfInfo failed:', error);
      }
      originalName.value = newName;
      nameUpdatedAt.value = new Date().toISOString();
    }

    saveOk.value = true;
    saveMsg.value = 'Guardado ✓';
  } catch (error: any) {
    saveOk.value = false;
    saveMsg.value = `No se pudo guardar: ${error?.message || 'error'}`;
  } finally {
    saving.value = false;
  }
}

function notImplemented() {
  infoMsg.value = 'Esta opción estará disponible pronto.';
}

async function handleLogout() {
  await logout();
  router.push({ path: '/login' });
}
</script>

<style scoped>
.settings {
  /* The global stylesheet sets overflow:hidden on body, so every page
     must be its own scroll container. */
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #000;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  padding-bottom: 40px;
}

/* iOS nav bar */
.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 8px;
  background: rgba(0, 0, 0, 0.6);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
}
.nav-spacer {
  min-width: 44px;
}
.nav-title {
  font-size: 17px;
  font-weight: 700;
}

.content {
  padding: 8px 16px;
}

/* Grouped inset list */
.group-header {
  margin: 22px 4px 7px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #8e8e93;
}
.group-footer {
  margin: 7px 4px 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: #8e8e93;
}
.group-footer.locked {
  color: #ff9f0a;
}

.group {
  border-radius: 16px;
  overflow: hidden;
  background: rgba(30, 30, 34, 0.55);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 10px 16px;
  box-sizing: border-box;
  background: none;
  border: none;
  color: #fff;
  font-size: 16px;
  text-align: left;
}
/* Hairline separators between rows (inset past the icon) */
.row + .row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 0;
  height: 0.5px;
  background: rgba(255, 255, 255, 0.1);
}
.row-tap {
  cursor: pointer;
}
.row-tap:active {
  background: rgba(255, 255, 255, 0.06);
}

.row-key {
  flex-shrink: 0;
}
.row-val {
  margin-left: auto;
  color: #8e8e93;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: ui-monospace, 'SF Mono', monospace;
}

/* Editable rows */
.row-input .row-key {
  min-width: 74px;
  color: #fff;
}
.row-field {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: #fff;
  font-size: 16px;
  font-family: inherit;
  text-align: right;
}
.row-field::placeholder {
  color: #6a6a70;
}
.row-field:disabled {
  color: #8e8e93;
}
.row-textarea {
  align-items: flex-start;
}
.row-textarea .row-key {
  padding-top: 2px;
}
textarea.row-field {
  resize: none;
  text-align: right;
  line-height: 1.45;
}

/* Colored rounded icon tiles (iOS Settings look) */
.ic {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ic-bell { background: #ff3b30; }
.ic-lock { background: #34c759; }
.ic-moon { background: #5e5ce6; }
.ic-vip { background: linear-gradient(135deg, #ffd75e, #ff9d2f); }
.ic-vip::after {
  content: '';
  position: absolute;
  top: -60%;
  left: -60%;
  width: 45%;
  height: 220%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.75), transparent);
  transform: rotate(18deg);
  animation: ic-vip-shine 3.2s ease-in-out infinite;
}
@keyframes ic-vip-shine {
  0% { left: -60%; }
  55% { left: 140%; }
  100% { left: 140%; }
}
.vip-val { color: #ffcf5e; }
.ic-verified { background: transparent; }
.verified-val { color: #1d9bf0; }
.ic-creator { background: linear-gradient(135deg, #ff5ec4, #7b2ff7); }
.creator-val { color: #d68bff; }
.ic-camera { background: linear-gradient(135deg, #ff2e74, #ff6a3d); }
.ic-money { background: linear-gradient(135deg, #34c759, #16a34a); }
.ic-stats { background: linear-gradient(135deg, #8b3dff, #ff2e74); }
.ic-fans { background: linear-gradient(135deg, #ff9d2f, #ff5ec4); }
.ic-agency { background: linear-gradient(135deg, #5e5ce6, #0a84ff); }
.ic-store { background: linear-gradient(135deg, #a259ff, #6d28d9); }
.ic-intro { background: linear-gradient(135deg, #14b8a6, #0e7490); }
.ic-cards { background: linear-gradient(135deg, #f59e0b, #ef4444); }
.ic-games { background: linear-gradient(135deg, #ec4899, #8b5cf6); }
.row-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff3b30;
  margin-left: auto;
}
.row-dot + .chev { margin-left: 10px; }
.ic-admin { background: linear-gradient(135deg, #34c759, #0a8f3f); }

.chev {
  margin-left: auto;
  display: flex;
  color: #55555b;
}

/* iOS toggle switch */
.switch {
  margin-left: auto;
  width: 51px;
  height: 31px;
  border-radius: 16px;
  border: none;
  background: #39393d;
  position: relative;
  cursor: pointer;
  transition: background 0.25s ease;
  flex-shrink: 0;
}
.switch.on {
  background: #34c759;
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.25s ease;
}
.switch.on .knob {
  transform: translateX(20px);
}

.row-danger {
  justify-content: center;
}
.row-danger .row-key {
  color: #ff453a;
  font-weight: 500;
}

/* Save */
.save-msg {
  margin: 12px 4px 0;
  font-size: 13px;
}
.save-msg.ok { color: #34c759; }
.save-msg.err { color: #ff453a; }

.save-btn {
  width: 100%;
  height: 50px;
  margin-top: 14px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #8b3dff 0%, #ff2e74 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(139, 61, 255, 0.35);
}
.save-btn:disabled {
  opacity: 0.6;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.info-msg {
  margin: 14px 4px 0;
  text-align: center;
  font-size: 13px;
  color: #c48bff;
}
</style>
