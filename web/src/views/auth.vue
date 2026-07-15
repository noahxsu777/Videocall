<template>
  <div class="auth-screen">
    <!-- Ambient purple/magenta glows to match the reference -->
    <div class="bg-glow bg-glow-1" />
    <div class="bg-glow bg-glow-2" />
    <div class="bg-glow bg-glow-3" />

    <div class="auth-card">
      <!-- Hero illustration -->
      <div class="hero">
        <div class="hero-blob" />
        <div class="hero-emoji">{{ mode === 'login' ? '🧑‍💻' : '🚀' }}</div>
      </div>

      <div class="head">
        <h1 class="title">{{ mode === 'login' ? '¡Bienvenido!' : 'Crea tu cuenta' }}</h1>
        <p class="subtitle">
          {{ mode === 'login'
            ? 'Qué bueno verte de nuevo'
            : 'Gratis para siempre. Sin tarjeta.' }}
        </p>
      </div>

      <div v-if="!isSupabaseConfigured" class="config-note">
        Falta configurar Supabase. Agrega <code>VITE_SUPABASE_URL</code> y
        <code>VITE_SUPABASE_ANON_KEY</code> en las variables de entorno de Vercel.
      </div>

      <template v-else>
        <form class="form" @submit.prevent="handleSubmit">
          <div v-if="mode === 'register'" class="field">
            <label class="field-label">Tu nombre</label>
            <div class="input-wrap">
              <span class="input-icon" v-html="ICONS.user" />
              <input
                v-model.trim="displayName"
                type="text"
                placeholder="@tunombre"
                autocomplete="nickname"
                maxlength="30"
              />
            </div>
          </div>

          <div class="field">
            <label class="field-label">Correo</label>
            <div class="input-wrap">
              <span class="input-icon" v-html="ICONS.mail" />
              <input
                v-model.trim="email"
                type="email"
                placeholder="tucorreo@gmail.com"
                autocomplete="email"
              />
            </div>
          </div>

          <div class="field">
            <label class="field-label">Contraseña</label>
            <div class="input-wrap">
              <span class="input-icon" v-html="ICONS.key" />
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="• • • • • • • •"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              />
              <button type="button" class="reveal" @click="showPassword = !showPassword">
                <span v-html="showPassword ? ICONS.eyeOff : ICONS.eye" />
              </button>
            </div>

            <!-- Password strength (register only) -->
            <div v-if="mode === 'register' && password" class="strength">
              <span
                v-for="i in 3"
                :key="i"
                class="strength-bar"
                :class="{ on: strength.score >= i }"
                :style="strength.score >= i ? { background: strength.color } : {}"
              />
              <span class="strength-label" :style="{ color: strength.color }">
                {{ strength.label }}
              </span>
            </div>

            <button
              v-if="mode === 'login'"
              type="button"
              class="forgot"
              @click="onForgot"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <p v-if="errorMessage" class="msg error">{{ errorMessage }}</p>
          <p v-if="infoMessage" class="msg info">{{ infoMessage }}</p>

          <button type="submit" class="submit" :disabled="loading">
            <span v-if="loading" class="spinner" />
            <span v-else>{{ mode === 'login' ? 'Iniciar sesión' : 'Registrarse' }}</span>
          </button>
        </form>

        <div class="divider"><span>o continúa con</span></div>

        <div class="socials">
          <button type="button" class="social" @click="onSocial" v-html="ICONS.google" />
          <button type="button" class="social" @click="onSocial" v-html="ICONS.apple" />
          <button type="button" class="social" @click="onSocial" v-html="ICONS.facebook" />
        </div>

        <p class="switch">
          {{ mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?' }}
          <button type="button" class="switch-link" @click="switchMode(mode === 'login' ? 'register' : 'login')">
            {{ mode === 'login' ? 'Regístrate' : 'Inicia sesión' }}
          </button>
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
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
const errorMessage = ref(route.query.banned === '1' ? 'Tu cuenta ha sido suspendida.' : '');
const infoMessage = ref('');

// Inline monochrome SVG icons (CSP-safe — no external assets).
const ICONS = {
  user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
  key: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 3-9.5 9.5"/><path d="m15.5 8.5 3 3"/></svg>',
  eye: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.6 6.6C3.6 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  google: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="#4285F4" d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.9a5.05 5.05 0 0 1-2.19 3.31v2.76h3.54c2.08-1.92 3.25-4.74 3.25-8.08Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.54-2.76c-.98.66-2.24 1.06-3.74 1.06-2.87 0-5.3-1.94-6.17-4.55H2.18v2.85A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.83 14.08a6.6 6.6 0 0 1 0-4.16V7.07H2.18a11 11 0 0 0 0 9.86l3.65-2.85Z"/><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.2 1.64l3.14-3.14C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.07l3.65 2.85C6.7 6.69 9.13 4.75 12 4.75Z"/></svg>',
  apple: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M17.05 12.54c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.83 1.3 10.39.86 1.25 1.89 2.66 3.24 2.61 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.54.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.13-.03-.02 0 0 0 0Z"/><path d="M14.66 4.9c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12Z"/></svg>',
};

const strength = computed(() => {
  const p = password.value;
  let score = 0;
  if (p.length >= 6) {
    score++;
  }
  if (p.length >= 10 || /\d/.test(p)) {
    score++;
  }
  if (/[^A-Za-z0-9]/.test(p) && p.length >= 8) {
    score++;
  }
  score = Math.min(3, Math.max(p ? 1 : 0, score));
  const table = [
    { label: '', color: '#71717a' },
    { label: 'Débil', color: '#fb5b7d' },
    { label: 'Media', color: '#f5a623' },
    { label: 'Fuerte', color: '#3ddc84' },
  ];
  return { score, ...table[score] };
});

const switchMode = (next: 'login' | 'register') => {
  mode.value = next;
  errorMessage.value = '';
  infoMessage.value = '';
};

const onForgot = () => {
  infoMessage.value = 'Escríbenos para restablecer tu contraseña. Pronto podrás hacerlo aquí.';
};
const onSocial = () => {
  infoMessage.value = 'El inicio con redes sociales estará disponible pronto.';
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
  padding: 24px 16px;
  box-sizing: border-box;
  background:
    radial-gradient(120% 90% at 50% -10%, #3a1d4d 0%, #1c1030 45%, #0d0718 100%);
  overflow: hidden;
}

/* Ambient purple/magenta glows */
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
.bg-glow-1 {
  top: -60px;
  left: -40px;
  width: 260px;
  height: 260px;
  background: #7b2ff7;
  opacity: 0.5;
}
.bg-glow-2 {
  bottom: -80px;
  right: -50px;
  width: 300px;
  height: 300px;
  background: #ff2e74;
  opacity: 0.42;
}
.bg-glow-3 {
  top: 40%;
  left: 55%;
  width: 180px;
  height: 180px;
  background: #b14dff;
  opacity: 0.3;
}

.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 360px;
  box-sizing: border-box;
  padding: 22px;
  border-radius: 26px;
  background: rgba(20, 12, 34, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
}

/* Hero */
.hero {
  position: relative;
  height: 108px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}
.hero-blob {
  position: absolute;
  width: 118px;
  height: 118px;
  border-radius: 42% 58% 55% 45% / 50% 45% 55% 50%;
  background: linear-gradient(140deg, #8b3dff 0%, #ff2e74 100%);
  filter: blur(2px);
  opacity: 0.9;
  animation: float 5s ease-in-out infinite;
}
.hero-emoji {
  position: relative;
  font-size: 58px;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5));
}
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(4deg); }
}

.head {
  text-align: center;
  margin-bottom: 20px;
}
.title {
  margin: 0;
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #fff;
}
.subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #c9bfe0;
}

.config-note {
  background: rgba(74, 52, 16, 0.5);
  color: #ffcf8f;
  border: 1px solid #4a3410;
  border-radius: 14px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}
.config-note code {
  color: #ffe4b5;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field-label {
  display: block;
  margin: 0 0 7px 2px;
  font-size: 12.5px;
  font-weight: 600;
  color: #c9bfe0;
}
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 14px;
  display: flex;
  color: #9a8fbf;
  pointer-events: none;
}
.input-wrap input {
  width: 100%;
  height: 50px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 0 44px;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, background 0.2s;
}
.input-wrap input::placeholder {
  color: #7d7397;
}
.input-wrap input:focus {
  border-color: #b14dff;
  background: rgba(255, 255, 255, 0.08);
}
.reveal {
  position: absolute;
  right: 12px;
  display: flex;
  background: none;
  border: none;
  color: #9a8fbf;
  cursor: pointer;
  padding: 4px;
}

/* Password strength */
.strength {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 9px 2px 0;
}
.strength-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.2s;
}
.strength-label {
  font-size: 11px;
  font-weight: 700;
  min-width: 44px;
  text-align: right;
}

.forgot {
  align-self: flex-end;
  margin: 10px 2px 0 0;
  background: none;
  border: none;
  color: #c48bff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  margin-left: auto;
  display: block;
}

.msg {
  margin: 2px 2px 0;
  font-size: 13px;
}
.msg.error {
  color: #ff6f8b;
}
.msg.info {
  color: #7fe0a8;
}

.submit {
  height: 52px;
  margin-top: 4px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(90deg, #8b3dff 0%, #ff2e74 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 28px rgba(160, 45, 200, 0.45);
  transition: opacity 0.2s, transform 0.1s;
}
.submit:active {
  transform: scale(0.99);
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

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 16px;
  color: #8a7fae;
  font-size: 12px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.socials {
  display: flex;
  justify-content: center;
  gap: 14px;
}
.social {
  width: 54px;
  height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}
.social:hover {
  background: rgba(255, 255, 255, 0.1);
}

.switch {
  margin: 20px 0 2px;
  text-align: center;
  font-size: 13px;
  color: #b3a9cf;
}
.switch-link {
  background: none;
  border: none;
  color: #c48bff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 2px;
}
</style>
