<template>
  <div class="verified-page">
    <header class="nav">
      <GlassBackButton @click="router.back()" />
      <span class="nav-title">Verificación</span>
      <span class="nav-spacer" />
    </header>

    <div class="hero">
      <div class="badge-wrap">
        <VerifiedBadge :size="64" />
      </div>
      <h1>Cuenta verificada</h1>
      <p v-if="isVerified" class="active">Tu cuenta ya tiene la insignia verificada ✓</p>
      <p v-else-if="requested" class="active">Solicitud enviada — en revisión ⏳</p>
      <p v-else class="sub">Solicita el check azul al estilo de Twitter/X</p>
    </div>

    <ul class="perks">
      <li><span class="pk-ic">✓</span> Insignia azul junto a tu nombre en todas partes</li>
      <li><span class="pk-ic">🔎</span> Más visibilidad y confianza frente a otros usuarios</li>
      <li><span class="pk-ic">💬</span> Se ve en mensajes, comentarios y en tu perfil</li>
      <li><span class="pk-ic">♾️</span> Es permanente, no caduca</li>
    </ul>

    <div v-if="!isVerified && !requested" class="note-card">
      <label class="note-label">¿Por qué quieres verificarte? (opcional)</label>
      <textarea
        v-model.trim="note"
        rows="3"
        maxlength="300"
        placeholder="Cuéntanos quién eres, tus redes, por qué mereces el check…"
      />
    </div>

    <p v-if="msg" class="msg" :class="ok ? 'ok' : 'err'">{{ msg }}</p>

    <button
      v-if="!isVerified && !requested"
      class="buy"
      :disabled="sending"
      @click="apply"
    >
      <span v-if="sending" class="spinner" />
      <span v-else>Solicitar verificación</span>
    </button>
    <p v-if="!isVerified && !requested" class="fineprint">
      Tu solicitud será revisada manualmente. Te avisaremos cuando se apruebe.
    </p>
    <p v-else-if="requested" class="fineprint">
      Ya tienes una solicitud pendiente. Un administrador la revisará pronto.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import VerifiedBadge from '../components/VerifiedBadge.vue';
import { useAuth } from '../auth/useAuth';
import { getProfile, requestVerification } from '../data/profiles';

const router = useRouter();
const { user } = useAuth();

const isVerified = ref(false);
const requested = ref(false);
const note = ref('');
const sending = ref(false);
const msg = ref('');
const ok = ref(false);

onMounted(async () => {
  if (!user.value) {
    return;
  }
  try {
    const p = await getProfile(user.value.id);
    isVerified.value = !!p?.verified;
    requested.value = !!(p as any)?.verification_requested;
  } catch (error) {
    console.error('[verified] load failed:', error);
  }
});

async function apply() {
  if (!user.value) {
    return;
  }
  msg.value = '';
  sending.value = true;
  try {
    await requestVerification(note.value || undefined);
    requested.value = true;
    ok.value = true;
    msg.value = '¡Solicitud enviada! La revisaremos pronto ⏳';
  } catch (error: any) {
    ok.value = false;
    msg.value = `No se pudo enviar: ${error?.message || 'error'}`;
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.verified-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: radial-gradient(120% 80% at 50% 0%, #062a3a 0%, #0a0a0c 55%);
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
.nav-title { font-size: 17px; font-weight: 700; }

.hero {
  text-align: center;
  padding: 14px 20px 6px;
}
.badge-wrap {
  display: inline-flex;
  filter: drop-shadow(0 6px 18px rgba(29, 155, 240, 0.5));
  animation: badge-float 3.4s ease-in-out infinite;
}
@keyframes badge-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-7px) scale(1.04); }
}
.hero h1 {
  margin: 10px 0 4px;
  font-size: 26px;
  font-weight: 800;
}
.sub { margin: 0; font-size: 14px; color: #9fc9dd; }
.active { margin: 0; font-size: 14px; color: #1d9bf0; font-weight: 600; }

.perks {
  list-style: none;
  margin: 18px 18px 8px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(29, 155, 240, 0.22);
}
.perks li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  font-size: 14px;
  line-height: 1.4;
  color: #eee;
}
.pk-ic { font-size: 18px; flex-shrink: 0; width: 22px; text-align: center; color: #1d9bf0; }

.price-card {
  margin: 16px 18px 0;
  padding: 16px;
  border-radius: 16px;
  background: rgba(29, 155, 240, 0.08);
  border: 1.5px solid rgba(29, 155, 240, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.price-label { font-size: 12px; color: #9fc9dd; text-transform: uppercase; letter-spacing: 0.4px; }
.price-amount { font-size: 24px; font-weight: 800; }
.price-balance { font-size: 12.5px; color: #7a8a92; margin-top: 2px; }

.note-card { margin: 16px 18px 0; display: flex; flex-direction: column; gap: 8px; }
.note-label { font-size: 12.5px; font-weight: 600; color: #9fc9dd; }
.note-card textarea {
  border-radius: 12px;
  border: 1px solid rgba(29, 155, 240, 0.3);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding: 12px 14px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  resize: none;
  line-height: 1.45;
}
.note-card textarea::placeholder { color: #6a7a82; }

.msg { text-align: center; font-size: 14px; margin: 12px 16px 0; }
.msg.ok { color: #1d9bf0; }
.msg.err { color: #ff6f8b; }

.buy {
  position: relative;
  overflow: hidden;
  display: flex;
  width: calc(100% - 32px);
  margin: 16px 16px 0;
  height: 52px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #1d9bf0, #0a6dc2);
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 26px rgba(29, 155, 240, 0.4);
}
.buy::after {
  content: '';
  position: absolute;
  top: -80%;
  left: -50%;
  width: 35%;
  height: 260%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: rotate(18deg);
  animation: buy-shine 3.6s ease-in-out infinite;
}
@keyframes buy-shine {
  0% { left: -50%; }
  55% { left: 140%; }
  100% { left: 140%; }
}
.buy:disabled { opacity: 0.6; }
.buy:disabled::after { animation-play-state: paused; }
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.fineprint {
  margin: 12px 24px 0;
  text-align: center;
  font-size: 11.5px;
  color: #7a8a92;
  line-height: 1.5;
}
</style>
