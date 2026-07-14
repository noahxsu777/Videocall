<template>
  <div class="settings">
    <header class="s-top">
      <button class="s-back" @click="router.back()">‹</button>
      <span class="s-title">Ajustes</span>
      <span class="s-back" />
    </header>

    <!-- Edit profile -->
    <section class="card">
      <h3 class="card-title">Editar perfil</h3>

      <label class="lbl">Usuario</label>
      <input
        v-model.trim="username"
        class="inp"
        type="text"
        maxlength="24"
        placeholder="tunombre"
        :disabled="!canChangeName"
      />
      <p class="hint" :class="{ locked: !canChangeName }">
        <template v-if="canChangeName">
          Este es el nombre que se ve en tus lives y perfil. Solo puedes cambiarlo cada 30 días.
        </template>
        <template v-else>
          🔒 Podrás cambiar tu usuario en {{ daysLeft }} {{ daysLeft === 1 ? 'día' : 'días' }}.
        </template>
      </p>

      <label class="lbl">Bio</label>
      <textarea v-model.trim="bio" class="inp inp-area" maxlength="160" rows="3" placeholder="Cuéntanos sobre ti" />

      <p v-if="saveMsg" class="save-msg" :class="saveOk ? 'ok' : 'err'">{{ saveMsg }}</p>

      <button class="btn-primary" :disabled="saving" @click="save">
        <span v-if="saving" class="spinner" />
        <span v-else>Guardar cambios</span>
      </button>
    </section>

    <!-- Account -->
    <section class="card">
      <h3 class="card-title">Cuenta</h3>
      <div class="row">
        <span class="row-label">Correo</span>
        <span class="row-value">{{ user?.email || '—' }}</span>
      </div>
      <div class="row">
        <span class="row-label">ID de usuario</span>
        <span class="row-value mono">{{ shortId }}</span>
      </div>
    </section>

    <!-- Preferences -->
    <section class="card">
      <h3 class="card-title">Preferencias</h3>
      <button class="list-row" @click="notImplemented">
        <span>🔔 Notificaciones</span><span class="chev">›</span>
      </button>
      <button class="list-row" @click="notImplemented">
        <span>🔒 Privacidad</span><span class="chev">›</span>
      </button>
      <button class="list-row" @click="notImplemented">
        <span>🌙 Tema oscuro</span><span class="chev">Activado</span>
      </button>
    </section>

    <!-- About -->
    <section class="card">
      <h3 class="card-title">Acerca de</h3>
      <div class="row">
        <span class="row-label">Versión</span>
        <span class="row-value">1.0.0</span>
      </div>
      <button class="list-row" @click="notImplemented">
        <span>📄 Términos y privacidad</span><span class="chev">›</span>
      </button>
    </section>

    <p v-if="infoMsg" class="info-msg">{{ infoMsg }}</p>

    <button class="btn-logout" @click="handleLogout">Cerrar sesión</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import TUIRoomEngine from '@tencentcloud/tuiroom-engine-js';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../auth/supabase';
import {
  getProfile,
  ensureProfile,
  updateProfile,
  updateDisplayName,
  daysUntilNameChange,
} from '../data/profiles';

const router = useRouter();
const { user, displayName, logout } = useAuth();

const username = ref('');
const bio = ref('');
const originalName = ref('');
const nameUpdatedAt = ref<string | null>(null);
const saving = ref(false);
const saveMsg = ref('');
const saveOk = ref(false);
const infoMsg = ref('');

const shortId = computed(() => (user.value?.id || '').slice(0, 8) || '—');
const daysLeft = computed(() => daysUntilNameChange(nameUpdatedAt.value));
const canChangeName = computed(() => daysLeft.value === 0);

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
    // Bio can change any time.
    await updateProfile(user.value.id, { bio: bio.value || '' });

    if (nameChanged) {
      await updateDisplayName(user.value.id, newName);
      // Mirror to the auth metadata so future logins + the greeting use it.
      await supabase?.auth.updateUser({ data: { display_name: newName } });
      // Update the live/chat SDK immediately so open sessions reflect it.
      try {
        await TUIRoomEngine.setSelfInfo({ userName: newName, avatarUrl: '' });
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
  min-height: 100vh;
  background: #050308;
  color: #fff;
  padding-bottom: 40px;
}
.s-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 8px;
  position: sticky;
  top: 0;
  background: #050308;
  z-index: 5;
}
.s-back {
  min-width: 44px;
  height: 44px;
  background: none;
  border: none;
  color: #fff;
  font-size: 26px;
  cursor: pointer;
}
.s-title {
  font-size: 17px;
  font-weight: 700;
}

.card {
  margin: 12px 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
}
.card-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: #c9bfe0;
}

.lbl {
  display: block;
  margin: 12px 0 6px;
  font-size: 12.5px;
  color: #9a8fbf;
}
.lbl:first-of-type {
  margin-top: 0;
}
.inp {
  width: 100%;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 12px 14px;
  font-size: 15px;
  outline: none;
}
.inp:focus {
  border-color: #b14dff;
}
.inp:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.inp-area {
  resize: none;
  font-family: inherit;
  line-height: 1.5;
}

.hint {
  margin: 8px 2px 0;
  font-size: 12px;
  line-height: 1.5;
  color: #8a8fb0;
}
.hint.locked {
  color: #ffb454;
}

.save-msg {
  margin: 12px 0 0;
  font-size: 13px;
}
.save-msg.ok {
  color: #7fe0a8;
}
.save-msg.err {
  color: #ff6f8b;
}

.btn-primary {
  width: 100%;
  height: 46px;
  margin-top: 14px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(90deg, #8b3dff 0%, #ff2e74 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-primary:disabled {
  opacity: 0.6;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.row:last-child {
  border-bottom: none;
}
.row-label {
  font-size: 14px;
  color: #b3a9cf;
}
.row-value {
  font-size: 14px;
  color: #fff;
}
.mono {
  font-family: ui-monospace, monospace;
  color: #9a8fbf;
}

.list-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 13px 0;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.list-row:last-child {
  border-bottom: none;
}
.chev {
  color: #7d7397;
  font-size: 14px;
}

.info-msg {
  margin: 4px 20px;
  text-align: center;
  font-size: 13px;
  color: #c48bff;
}

.btn-logout {
  display: block;
  width: calc(100% - 28px);
  margin: 8px 14px 0;
  height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(255, 79, 112, 0.4);
  background: rgba(255, 46, 116, 0.1);
  color: #ff6f8b;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
</style>
