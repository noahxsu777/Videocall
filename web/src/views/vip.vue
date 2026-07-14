<template>
  <div class="vip">
    <header class="nav">
      <GlassBackButton @click="router.back()" />
      <span class="nav-title">VIP</span>
      <span class="nav-spacer" />
    </header>

    <div class="hero">
      <div class="crown">👑</div>
      <h1>Hazte VIP</h1>
      <p v-if="isVip" class="active">Tu VIP está activo hasta el {{ vipUntilText }}</p>
      <p v-else class="sub">Desbloquea mensajes silenciosos y más</p>
    </div>

    <ul class="perks">
      <li><span class="pk-ic">🤫</span> Mensajes silenciosos: solo el anfitrión y otros VIP los ven</li>
      <li><span class="pk-ic">⭐</span> Insignia VIP dorada en tu perfil y en el chat</li>
      <li><span class="pk-ic">🚀</span> Tus mensajes destacados en los lives</li>
      <li><span class="pk-ic">🎁</span> Acceso anticipado a nuevas funciones</li>
    </ul>

    <div class="plans">
      <button
        v-for="plan in plans"
        :key="plan.days"
        class="plan"
        :class="{ sel: selected === plan.days }"
        @click="selected = plan.days"
      >
        <span v-if="plan.tag" class="plan-tag">{{ plan.tag }}</span>
        <span class="plan-name">{{ plan.name }}</span>
        <span class="plan-price">{{ plan.price }}</span>
        <span class="plan-per">{{ plan.per }}</span>
      </button>
    </div>

    <p v-if="msg" class="msg" :class="ok ? 'ok' : 'err'">{{ msg }}</p>

    <button class="buy" :disabled="buying" @click="buy">
      <span v-if="buying" class="spinner" />
      <span v-else>{{ isVip ? 'Extender VIP' : 'Activar VIP' }}</span>
    </button>
    <p class="fineprint">
      Compra simulada para demo — activa el VIP al instante sin cobro real.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import { useAuth } from '../auth/useAuth';
import { getProfile, activateVip, isVipActive } from '../data/profiles';

const router = useRouter();
const { user } = useAuth();

const plans = [
  { days: 7, name: 'Semana', price: '$1.99', per: '7 días', tag: '' },
  { days: 30, name: 'Mes', price: '$4.99', per: '30 días', tag: 'Popular' },
  { days: 365, name: 'Año', price: '$39.99', per: '365 días', tag: 'Ahorra 33%' },
];
const selected = ref(30);
const vipUntil = ref<string | null>(null);
const buying = ref(false);
const msg = ref('');
const ok = ref(false);

const isVip = computed(() => isVipActive(vipUntil.value));
const vipUntilText = computed(() =>
  vipUntil.value ? new Date(vipUntil.value).toLocaleDateString() : '');

onMounted(async () => {
  if (!user.value) {
    return;
  }
  try {
    const p = await getProfile(user.value.id);
    vipUntil.value = p?.vip_until || null;
  } catch (error) {
    console.error('[vip] load failed:', error);
  }
});

async function buy() {
  if (!user.value) {
    return;
  }
  msg.value = '';
  buying.value = true;
  try {
    const until = await activateVip(user.value.id, selected.value);
    vipUntil.value = until;
    ok.value = true;
    msg.value = '¡Listo! Ya eres VIP 👑';
  } catch (error: any) {
    ok.value = false;
    msg.value = `No se pudo activar: ${error?.message || 'error'}`;
  } finally {
    buying.value = false;
  }
}
</script>

<style scoped>
.vip {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: radial-gradient(120% 80% at 50% 0%, #2a1f05 0%, #0a0a0c 55%);
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
.crown {
  display: inline-block;
  font-size: 56px;
  filter: drop-shadow(0 6px 18px rgba(255, 180, 40, 0.5));
  animation: crown-float 3.4s ease-in-out infinite;
}
@keyframes crown-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-7px) rotate(-4deg); }
}
.hero h1 {
  margin: 8px 0 4px;
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(135deg, #ffe08a, #ff9d2f);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sub { margin: 0; font-size: 14px; color: #c9bfa0; }
.active { margin: 0; font-size: 14px; color: #ffd75e; font-weight: 600; }

.perks {
  list-style: none;
  margin: 18px 18px 8px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 215, 120, 0.18);
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

.plans {
  display: flex;
  gap: 10px;
  padding: 12px 16px 4px;
}
.plan {
  position: relative;
  flex: 1;
  padding: 16px 6px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.plan.sel {
  border-color: #ffcf5e;
  background: rgba(255, 207, 94, 0.12);
}
.plan-tag {
  position: absolute;
  top: -9px;
  overflow: hidden;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 8px;
  color: #1a1400;
  background: linear-gradient(135deg, #ffd75e, #ff9d2f);
  white-space: nowrap;
}
.plan-tag::after {
  content: '';
  position: absolute;
  top: -60%;
  left: -60%;
  width: 45%;
  height: 220%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.75), transparent);
  transform: rotate(18deg);
  animation: plan-tag-shine 3s ease-in-out infinite;
}
@keyframes plan-tag-shine {
  0% { left: -60%; }
  55% { left: 140%; }
  100% { left: 140%; }
}
.plan-name { font-size: 13px; color: #c9bfa0; }
.plan-price { font-size: 19px; font-weight: 800; }
.plan-per { font-size: 11px; color: #8a8577; }

.msg { text-align: center; font-size: 14px; margin: 12px 16px 0; }
.msg.ok { color: #ffd75e; }
.msg.err { color: #ff6f8b; }

.buy {
  position: relative;
  overflow: hidden;
  display: block;
  width: calc(100% - 32px);
  margin: 16px 16px 0;
  height: 52px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffd75e, #ff9d2f);
  color: #1a1400;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 26px rgba(255, 157, 47, 0.4);
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
.buy:disabled { opacity: 0.7; }
.buy:disabled::after { animation-play-state: paused; }
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-top-color: #1a1400;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.fineprint {
  margin: 12px 24px 0;
  text-align: center;
  font-size: 11.5px;
  color: #7a7568;
  line-height: 1.5;
}
</style>
