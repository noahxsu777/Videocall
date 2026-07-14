<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-logo">
        <span class="auth-logo-emoji">🔴</span>
        <h1 class="auth-title">LiveStream</h1>
        <p class="auth-subtitle">
          {{ mode === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta' }}
        </p>
      </div>

      <div v-if="!isSupabaseConfigured" class="auth-warning">
        Falta configurar Supabase. Agrega <code>VITE_SUPABASE_URL</code> y
        <code>VITE_SUPABASE_ANON_KEY</code> en las variables de entorno.
      </div>

      <form v-else class="auth-form" @submit.prevent="handleSubmit">
        <div v-if="mode === 'register'" class="auth-field">
          <label>Nombre</label>
          <input
            v-model.trim="displayName"
            type="text"
            placeholder="Tu nombre"
            autocomplete="nickname"
            maxlength="30"
          />
        </div>

        <div class="auth-field">
          <label>Correo</label>
          <input
            v-model.trim="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            autocomplete="email"
          />
        </div>

        <div class="auth-field">
          <label>Contraseña</label>
          <input
            v-model="password"
            type="password"
            placeholder="Mínimo 6 caracteres"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          />
        </div>

        <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
        <p v-if="infoMessage" class="auth-info">{{ infoMessage }}</p>

        <button type="submit" class="auth-submit" :disabled="loading">
          {{ loading ? 'Un momento…' : (mode === 'login' ? 'Entrar' : 'Registrarme') }}
        </button>
      </form>

      <p class="auth-switch">
        <template v-if="mode === 'login'">
          ¿No tienes cuenta?
          <button type="button" class="auth-link" @click="switchMode('register')">Regístrate</button>
        </template>
        <template v-else>
          ¿Ya tienes cuenta?
          <button type="button" class="auth-link" @click="switchMode('login')">Inicia sesión</button>
        </template>
      </p>
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
    errorMessage.value = 'Ingresa tu nombre.';
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
      // If email confirmation is required, there's no session yet.
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
.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
  background: radial-gradient(circle at 30% 20%, #1c1130, #0e0e14 60%);
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: #16161f;
  border: 1px solid #262633;
  border-radius: 16px;
  padding: 28px 24px 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.auth-logo {
  text-align: center;
  margin-bottom: 24px;
}

.auth-logo-emoji {
  font-size: 34px;
}

.auth-title {
  margin: 10px 0 4px;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.auth-subtitle {
  margin: 0;
  font-size: 14px;
  color: #9a9aab;
}

.auth-warning {
  background: #3a2a12;
  color: #ffcf8f;
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.auth-warning code {
  color: #ffe4b5;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-field label {
  font-size: 13px;
  color: #c7c7d1;
}

.auth-field input {
  height: 46px;
  border-radius: 10px;
  border: 1px solid #2c2c3a;
  background: #1e1e29;
  color: #fff;
  padding: 0 14px;
  font-size: 15px;
  outline: none;
}

.auth-field input:focus {
  border-color: #fe2c55;
}

.auth-error {
  margin: 0;
  color: #ff5470;
  font-size: 13px;
}

.auth-info {
  margin: 0;
  color: #6ad19a;
  font-size: 13px;
}

.auth-submit {
  height: 48px;
  border: none;
  border-radius: 24px;
  background: #fe2c55;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 4px;
}

.auth-submit:disabled {
  opacity: 0.6;
  cursor: default;
}

.auth-switch {
  text-align: center;
  margin: 18px 0 0;
  font-size: 14px;
  color: #9a9aab;
}

.auth-link {
  background: none;
  border: none;
  color: #fe2c55;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 0 4px;
}
</style>
