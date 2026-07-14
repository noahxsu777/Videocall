<template>
  <div class="auth-screen">
    <!-- Ambient brand glow, TikTok-style -->
    <div class="glow glow-cyan" />
    <div class="glow glow-pink" />

    <div class="auth-inner">
      <div class="brand">
        <div class="brand-mark">
          <span class="brand-note">♪</span>
        </div>
        <h1 class="brand-name">LiveStream</h1>
        <p class="brand-tagline">Transmite, conecta y comparte en vivo</p>
      </div>

      <div v-if="!isSupabaseConfigured" class="config-note">
        Falta configurar Supabase. Agrega <code>VITE_SUPABASE_URL</code> y
        <code>VITE_SUPABASE_ANON_KEY</code> en las variables de entorno de Vercel.
      </div>

      <template v-else>
        <div class="tabs">
          <button
            type="button"
            class="tab"
            :class="{ active: mode === 'login' }"
            @click="switchMode('login')"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: mode === 'register' }"
            @click="switchMode('register')"
          >
            Registrarse
          </button>
          <span class="tab-underline" :class="mode" />
        </div>

        <form class="form" @submit.prevent="handleSubmit">
          <div v-if="mode === 'register'" class="field">
            <input
              v-model.trim="displayName"
              type="text"
              placeholder="Nombre de usuario"
              autocomplete="nickname"
              maxlength="30"
            />
          </div>

          <div class="field">
            <input
              v-model.trim="email"
              type="email"
              placeholder="Correo electrónico"
              autocomplete="email"
            />
          </div>

          <div class="field field-password">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Contraseña"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            />
            <button type="button" class="reveal" @click="showPassword = !showPassword">
              {{ showPassword ? 'Ocultar' : 'Ver' }}
            </button>
          </div>

          <p v-if="errorMessage" class="msg error">{{ errorMessage }}</p>
          <p v-if="infoMessage" class="msg info">{{ infoMessage }}</p>

          <button type="submit" class="submit" :disabled="loading">
            <span v-if="loading" class="spinner" />
            <span v-else>{{ mode === 'login' ? 'Entrar' : 'Crear cuenta' }}</span>
          </button>
        </form>

        <p class="legal">
          Al continuar aceptas los Términos y la Política de privacidad.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../auth/useAuth';

const router = useRouter();
const route = useRoute();
const { isSupabaseConfigured, register, login } = useAuth();

const mode = ref<'login' | 'register'>('login');
const displayName = ref('');
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const infoMessage = ref('');

const switchMode = (next: 'login' | 'register') => {
  mode.value = next;
  errorMessage.value = '';
  infoMessage.value = '';
};

const goAfterAuth = () => {
  const from = (route.query.from as string) || '/live-list';
  router.push({ path: from });
};

const handleSubmit = async () => {
  errorMessage.value = '';
  infoMessage.value = '';

  if (!email.value || !password.value) {
    errorMessage.value = 'Ingresa tu correo y contraseña.';
    return;
  }
  if (mode.value === 'register' && !displayName.value) {
    errorMessage.value = 'Ingresa un nombre de usuario.';
    return;
  }
  if (password.value.length < 6) {
    errorMessage.value = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }

  loading.value = true;
  try {
    if (mode.value === 'register') {
      const result = await register({
        email: email.value,
        password: password.value,
        displayName: displayName.value,
      });
      if (!result.session) {
        infoMessage.value = 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.';
        mode.value = 'login';
        return;
      }
      goAfterAuth();
    } else {
      await login({ email: email.value, password: password.value });
      goAfterAuth();
    }
  } catch (error: any) {
    errorMessage.value = translateError(error?.message || 'Ocurrió un error.');
  } finally {
    loading.value = false;
  }
};

function translateError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'User already registered': 'Ese correo ya está registrado.',
    'Email not confirmed': 'Confirma tu correo antes de iniciar sesión.',
  };
  return map[message] || message;
}
</script>

<style scoped>
.auth-screen {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  background: #010101;
  overflow: hidden;
}

/* Ambient brand glows (TikTok cyan/pink) */
.glow {
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.5;
  pointer-events: none;
}
.glow-cyan {
  top: -80px;
  left: -60px;
  background: #25f4ee;
}
.glow-pink {
  bottom: -90px;
  right: -70px;
  background: #fe2c55;
}

.auth-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 360px;
}

.brand {
  text-align: center;
  margin-bottom: 34px;
}
.brand-mark {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  border-radius: 22px;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow:
    3px 0 0 #fe2c55,
    -3px 0 0 #25f4ee;
}
.brand-note {
  font-size: 34px;
  color: #fff;
}
.brand-name {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #fff;
}
.brand-tagline {
  margin: 6px 0 0;
  font-size: 14px;
  color: #a1a1aa;
}

.config-note {
  background: #2a1e0c;
  color: #ffcf8f;
  border: 1px solid #4a3410;
  border-radius: 12px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}
.config-note code {
  color: #ffe4b5;
}

/* Tabs */
.tabs {
  position: relative;
  display: flex;
  margin-bottom: 22px;
  border-bottom: 1px solid #1f1f23;
}
.tab {
  flex: 1;
  background: none;
  border: none;
  padding: 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #71717a;
  cursor: pointer;
  transition: color 0.2s;
}
.tab.active {
  color: #fff;
}
.tab-underline {
  position: absolute;
  bottom: -1px;
  height: 2px;
  width: 50%;
  background: #fe2c55;
  border-radius: 2px;
  transition: transform 0.25s ease;
}
.tab-underline.login {
  transform: translateX(0);
}
.tab-underline.register {
  transform: translateX(100%);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field {
  position: relative;
}
.field input {
  width: 100%;
  height: 50px;
  border-radius: 10px;
  border: 1px solid #26262b;
  background: #121215;
  color: #fff;
  padding: 0 16px;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.field input::placeholder {
  color: #6b6b74;
}
.field input:focus {
  border-color: #fe2c55;
}
.field-password input {
  padding-right: 64px;
}
.reveal {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #a1a1aa;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.msg {
  margin: 2px 2px 0;
  font-size: 13px;
}
.msg.error {
  color: #ff5470;
}
.msg.info {
  color: #4ade80;
}

.submit {
  height: 50px;
  margin-top: 6px;
  border: none;
  border-radius: 10px;
  background: #fe2c55;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}
.submit:disabled {
  opacity: 0.6;
  cursor: default;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.legal {
  margin: 22px 0 0;
  text-align: center;
  font-size: 12px;
  color: #6b6b74;
  line-height: 1.6;
}
</style>
