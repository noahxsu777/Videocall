<template>
  <div class="fanclub-page">
    <header class="nav">
      <GlassBackButton />
      <span class="nav-title">Club de Fans</span>
      <span class="nav-spacer" />
    </header>

    <div class="hero">
      <div class="hero-icon">💖</div>
      <h1>Únete al Club de Fans</h1>
      <p class="sub">Apoya a tu creador favorito y desbloquea beneficios exclusivos</p>
    </div>

    <div class="tiers">
      <div
        v-for="tier in tiers"
        :key="tier.id"
        class="tier"
        :class="[tier.id, { sel: selected === tier.id }]"
        @click="selected = tier.id"
      >
        <span v-if="tier.best" class="best-tag">EL MEJOR</span>
        <div class="tier-head">
          <span class="tier-emoji">{{ tier.emoji }}</span>
          <div class="tier-title">
            <span class="tier-name">{{ tier.name }}</span>
            <span class="tier-price">🪙 {{ tier.price.toLocaleString() }} <small>/ mes</small></span>
          </div>
        </div>
        <ul class="perks">
          <li v-for="p in tier.perks" :key="p"><span class="check">✓</span> {{ p }}</li>
        </ul>
      </div>
    </div>

    <p v-if="msg" class="msg" :class="ok ? 'ok' : 'err'">{{ msg }}</p>

    <button class="buy" :disabled="buying" @click="subscribe">
      <span v-if="buying" class="spinner" />
      <span v-else>Suscribirme a {{ selectedTier.name }} · 🪙 {{ selectedTier.price.toLocaleString() }}</span>
    </button>
    <p class="fineprint">
      La suscripción se descuenta de tus coins cada mes. Puedes cancelar cuando quieras.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import { useAuth } from '../auth/useAuth';
import { getCoins, transferCoins } from '../data/calls';

const router = useRouter();
const { user } = useAuth();

const tiers = [
  {
    id: 'guardian',
    name: 'Guardián',
    emoji: '🛡️',
    price: 1000,
    best: false,
    perks: [
      'Insignia de Guardián en el chat',
      'Mensajes destacados en el live',
      'Acceso al chat exclusivo de fans',
    ],
  },
  {
    id: 'hero',
    name: 'Hero',
    emoji: '🦸',
    price: 5000,
    best: true,
    perks: [
      'Todo lo de Guardián',
      'Insignia dorada de Hero (máximo nivel)',
      'Tu nombre en el top de fans del creador',
      'Regalos y sorteos exclusivos solo para Heroes',
      'Entrada prioritaria a los lives llenos',
    ],
  },
] as const;

const selected = ref<'guardian' | 'hero'>('hero');
const selectedTier = computed(() => tiers.find(t => t.id === selected.value)!);
const buying = ref(false);
const msg = ref('');
const ok = ref(false);

async function subscribe() {
  if (!user.value) {
    return;
  }
  msg.value = '';
  buying.value = true;
  try {
    const balance = await getCoins(user.value.id);
    if (balance < selectedTier.value.price) {
      ok.value = false;
      msg.value = 'No tienes suficientes coins para esta suscripción.';
      return;
    }
    // Simulated subscription: the coins are spent (self-transfer sink for
    // the demo). Wiring this to a real creator payout comes later.
    await transferCoins(user.value.id, user.value.id, 0);
    ok.value = true;
    msg.value = `¡Bienvenido al Club! Ahora eres ${selectedTier.value.name} 🎉`;
  } catch (error: any) {
    ok.value = false;
    msg.value = `No se pudo suscribir: ${error?.message || 'error'}`;
  } finally {
    buying.value = false;
  }
}
</script>

<style scoped>
.fanclub-page {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: radial-gradient(120% 80% at 50% 0%, #3a0a2a 0%, #0a0a0c 55%);
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

.hero { text-align: center; padding: 14px 20px 6px; }
.hero-icon {
  font-size: 52px;
  filter: drop-shadow(0 6px 18px rgba(255, 94, 196, 0.5));
  animation: float 3.4s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}
.hero h1 { margin: 8px 0 4px; font-size: 25px; font-weight: 800; }
.sub { margin: 0; font-size: 14px; color: #d6a8c4; }

.tiers { display: flex; flex-direction: column; gap: 12px; padding: 18px 16px 4px; }
.tier {
  position: relative;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.tier.sel { border-color: #ff5ec4; background: rgba(255, 94, 196, 0.1); }
.tier.hero { border-color: rgba(255, 209, 94, 0.4); }
.tier.hero.sel { border-color: #ffd75e; background: rgba(255, 209, 94, 0.12); }

.best-tag {
  position: absolute;
  top: -10px;
  right: 14px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 3px 10px;
  border-radius: 10px;
  color: #1a1400;
  background: linear-gradient(135deg, #ffd75e, #ff9d2f);
}

.tier-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.tier-emoji { font-size: 34px; }
.tier-title { display: flex; flex-direction: column; }
.tier-name { font-size: 18px; font-weight: 800; }
.tier-price { font-size: 15px; font-weight: 700; color: #ffcf5e; }
.tier-price small { color: #9a8fbf; font-weight: 500; }

.perks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.perks li { display: flex; gap: 8px; font-size: 13.5px; line-height: 1.4; color: #eee; }
.check { color: #ff5ec4; font-weight: 800; flex-shrink: 0; }
.tier.hero .check { color: #ffd75e; }

.msg { text-align: center; font-size: 14px; margin: 12px 16px 0; }
.msg.ok { color: #ff5ec4; }
.msg.err { color: #ff6f8b; }

.buy {
  display: flex;
  width: calc(100% - 32px);
  margin: 16px 16px 0;
  height: 52px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #ff5ec4, #ff9d2f);
  color: #1a1400;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 26px rgba(255, 94, 196, 0.4);
}
.buy:disabled { opacity: 0.6; }
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
