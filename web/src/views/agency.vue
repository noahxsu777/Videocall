<template>
  <div class="agency-page">
    <header class="nav">
      <GlassBackButton />
      <span class="nav-title">Programa para agencias</span>
      <span class="nav-spacer" />
    </header>

    <div class="hero">
      <div class="hero-icon">🤝</div>
      <h1>Programa para agencias</h1>
      <p class="sub">¿Manejas creadores? Únete a nuestro programa y recibe beneficios por traer talento.</p>
    </div>

    <template v-if="!sent">
      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span class="label">Nombre de la agencia *</span>
          <input v-model.trim="form.agency_name" type="text" maxlength="80" placeholder="Mi Agencia" />
        </label>
        <label class="field">
          <span class="label">Tu nombre *</span>
          <input v-model.trim="form.contact_name" type="text" maxlength="80" placeholder="Nombre y apellido" />
        </label>
        <label class="field">
          <span class="label">Correo *</span>
          <input v-model.trim="form.email" type="email" placeholder="correo@ejemplo.com" />
        </label>
        <label class="field">
          <span class="label">WhatsApp / Teléfono</span>
          <input v-model.trim="form.phone" type="tel" maxlength="30" placeholder="+51 999 999 999" />
        </label>
        <label class="field">
          <span class="label">País</span>
          <input v-model.trim="form.country" type="text" maxlength="40" placeholder="Perú" />
        </label>
        <label class="field">
          <span class="label">¿Cuántos creadores manejas?</span>
          <input v-model.trim="form.creators" type="text" maxlength="40" placeholder="Ej. 5-10" />
        </label>
        <label class="field">
          <span class="label">Mensaje</span>
          <textarea v-model.trim="form.message" rows="3" maxlength="500" placeholder="Cuéntanos sobre tu agencia" />
        </label>

        <p v-if="err" class="msg err">{{ err }}</p>

        <button class="submit" type="submit" :disabled="sending">
          <span v-if="sending" class="spinner" />
          <span v-else>Enviar solicitud</span>
        </button>
      </form>
    </template>

    <div v-else class="done">
      <div class="done-icon">✅</div>
      <h2>¡Solicitud enviada!</h2>
      <p>Revisaremos tu información y te contactaremos por correo. Gracias por tu interés.</p>
      <button class="submit" @click="router.back()">Volver</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../auth/supabase';

const router = useRouter();
const { user } = useAuth();

const form = reactive({
  agency_name: '',
  contact_name: '',
  email: user.value?.email || '',
  phone: '',
  country: '',
  creators: '',
  message: '',
});

const sending = ref(false);
const sent = ref(false);
const err = ref('');

async function submit() {
  err.value = '';
  if (!form.agency_name || !form.contact_name || !form.email) {
    err.value = 'Completa los campos marcados con *.';
    return;
  }
  sending.value = true;
  try {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase.from('agency_applications').insert({
      user_id: user.value?.id || null,
      agency_name: form.agency_name,
      contact_name: form.contact_name,
      email: form.email,
      phone: form.phone || null,
      country: form.country || null,
      creators: form.creators || null,
      message: form.message || null,
    });
    if (error) {
      throw new Error(
        error.message.includes('does not exist') || error.message.includes('schema cache')
          ? 'Falta crear la tabla "agency_applications" en Supabase (revisa schema.sql).'
          : error.message,
      );
    }
    sent.value = true;
  } catch (error: any) {
    err.value = `No se pudo enviar: ${error?.message || 'error'}`;
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.agency-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: radial-gradient(120% 80% at 50% 0%, #0a2a3a 0%, #0a0a0c 55%);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  padding-bottom: 40px;
}
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 8px;
}
.nav-spacer { min-width: 44px; }
.nav-title { font-size: 16px; font-weight: 700; }

.hero { text-align: center; padding: 10px 20px 6px; }
.hero-icon { font-size: 46px; }
.hero h1 { margin: 8px 0 4px; font-size: 22px; font-weight: 800; }
.sub { margin: 0 auto; max-width: 320px; font-size: 13.5px; color: #9fc9dd; line-height: 1.5; }

.form { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 12.5px; font-weight: 600; color: #9fc9dd; }
.field input,
.field textarea {
  height: 46px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 0 14px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.field textarea { height: auto; padding: 12px 14px; resize: none; line-height: 1.45; }
.field input:focus,
.field textarea:focus { border-color: #14b8a6; }
.field input::placeholder,
.field textarea::placeholder { color: #6a7a82; }

.msg { font-size: 13px; margin: 0; }
.msg.err { color: #ff6f8b; }

.submit {
  height: 52px;
  margin-top: 6px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 22px rgba(139, 61, 255, 0.4);
}
.submit:disabled { opacity: 0.6; }
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.done { text-align: center; padding: 40px 24px; }
.done-icon { font-size: 56px; }
.done h2 { margin: 10px 0 6px; font-size: 22px; font-weight: 800; }
.done p { margin: 0 auto 24px; max-width: 300px; font-size: 14px; color: #9fc9dd; line-height: 1.5; }
.done .submit { width: 100%; }
</style>
