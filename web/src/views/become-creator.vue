<template>
  <div class="creator-page">
    <header class="nav">
      <GlassBackButton @click="router.back()" />
      <span class="nav-title">Creador</span>
      <span class="nav-spacer" />
    </header>

    <div class="hero">
      <div class="icon-wrap">🎥</div>
      <h1>Conviértete en Creador</h1>
      <p v-if="isCreator" class="active">Ya eres Creador en Hype Call ✓</p>
      <p v-else class="sub">Consigue la insignia de Creador en tu perfil</p>
    </div>

    <ul class="perks">
      <li><span class="pk-ic">🔴</span> Transmite en vivo cuando quieras</li>
      <li><span class="pk-ic">🎁</span> Recibe regalos y likes de tu audiencia</li>
      <li><span class="pk-ic">📞</span> Cobra por minuto en videollamadas</li>
      <li><span class="pk-ic">🏷️</span> Insignia de Creador visible en tu perfil</li>
    </ul>

    <div class="notice">
      Por ahora <strong>no necesitas aprobación</strong> para transmitir — cualquier
      cuenta puede iniciar un live desde el botón "+". Esta insignia es solo para
      destacar tu perfil; más adelante podría desbloquear beneficios extra.
    </div>

    <p v-if="msg" class="msg" :class="ok ? 'ok' : 'err'">{{ msg }}</p>

    <button v-if="!isCreator" class="buy" :disabled="saving" @click="activate">
      <span v-if="saving" class="spinner" />
      <span v-else>Convertirme en Creador</span>
    </button>
    <button v-else class="buy" @click="router.push('/live-pusher')">
      Ir a transmitir
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import { useAuth } from '../auth/useAuth';
import { getProfile, becomeCreator } from '../data/profiles';

const router = useRouter();
const { user } = useAuth();

const isCreator = ref(false);
const saving = ref(false);
const msg = ref('');
const ok = ref(false);

onMounted(async () => {
  if (!user.value) {
    return;
  }
  try {
    const p = await getProfile(user.value.id);
    isCreator.value = !!p?.is_creator;
  } catch (error) {
    console.error('[become-creator] load failed:', error);
  }
});

async function activate() {
  if (!user.value) {
    return;
  }
  msg.value = '';
  saving.value = true;
  try {
    await becomeCreator(user.value.id);
    isCreator.value = true;
    ok.value = true;
    msg.value = '¡Listo! Ya eres Creador 🎥';
  } catch (error: any) {
    ok.value = false;
    msg.value = `No se pudo activar: ${error?.message || 'error'}`;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.creator-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: radial-gradient(120% 80% at 50% 0%, #2a0a3a 0%, #0a0a0c 55%);
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
.icon-wrap {
  display: inline-block;
  font-size: 56px;
  filter: drop-shadow(0 6px 18px rgba(216, 79, 255, 0.5));
  animation: icon-float 3.4s ease-in-out infinite;
}
@keyframes icon-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-7px) scale(1.05); }
}
.hero h1 {
  margin: 8px 0 4px;
  font-size: 27px;
  font-weight: 800;
  background: linear-gradient(135deg, #ff5ec4, #a259ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sub { margin: 0; font-size: 14px; color: #cfa0dd; }
.active { margin: 0; font-size: 14px; color: #d68bff; font-weight: 600; }

.perks {
  list-style: none;
  margin: 18px 18px 8px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(216, 79, 255, 0.22);
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
.pk-ic { font-size: 20px; flex-shrink: 0; }

.notice {
  margin: 14px 18px 0;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12.5px;
  line-height: 1.6;
  color: #b8b0c4;
}
.notice strong { color: #fff; }

.msg { text-align: center; font-size: 14px; margin: 12px 16px 0; }
.msg.ok { color: #d68bff; }
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
  background: linear-gradient(135deg, #ff5ec4, #7b2ff7);
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 26px rgba(155, 45, 247, 0.4);
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
</style>
