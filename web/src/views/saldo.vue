<template>
  <div class="saldo">
    <GlassBackButton />
    <h1 class="title">Saldo</h1>

    <!-- TikTok-style: earnings shown as MONEY (auto-converted from the
         coins received in lives); the rechargeable Coins live in their own
         pill below. -->
    <div class="balance-card">
      <span class="bc-label">Saldo estimado (USD)</span>
      <div class="bc-amount">
        <span class="bc-gem">$</span>
        <span class="bc-value">{{ estimatedUsd }}</span>
      </div>
      <span class="bc-sub">Lo que ganas en tus lives se convierte en dólares automáticamente</span>
    </div>

    <button class="coins-pill" @click="scrollToPacks">
      <span class="cp-coins">🪙 Coins <strong>{{ coins.toLocaleString() }}</strong></span>
      <span class="cp-sep">|</span>
      <span class="cp-get">Obtener Coins →</span>
    </button>

    <!-- Buy coins (Stripe Checkout) -->
    <p ref="packsSection" class="section-title">Comprar Coins</p>
    <div class="packs">
      <button
        v-for="pack in payout.packs"
        :key="pack.id"
        class="pack"
        :disabled="busy"
        @click="handleBuy(pack.id)"
      >
        <span class="pack-coins">🪙 {{ pack.coins.toLocaleString() }}</span>
        <span class="pack-price">${{ pack.usd.toFixed(2) }}</span>
      </button>
    </div>

    <p class="hint">
      Los Coins que compras son para enviar regalos y hacer llamadas — no se
      pueden retirar. Solo lo que ganas transmitiendo (regalos recibidos) se
      convierte en tu saldo en dólares.
    </p>

    <!-- Withdrawals: connect a Stripe Express account, then cash out. -->
    <p class="section-title">Retirar</p>
    <section class="group">
      <div class="row">
        <span class="row-key">Estado de retiros</span>
        <span class="row-val" :class="{ ok: payout.payoutsEnabled }">{{ payoutStatusLabel }}</span>
      </div>
      <div v-if="payout.configured" class="row">
        <span class="row-key">Valor bruto</span>
        <span class="row-val">≈ ${{ estimatedUsd }} USD</span>
      </div>
      <div v-if="payout.configured" class="row">
        <span class="row-key">Recibirías (−{{ payout.payoutFeePercent }}% comisión)</span>
        <span class="row-val">≈ ${{ estimatedNetUsd }} USD</span>
      </div>
    </section>

    <button
      v-if="!payout.configured"
      class="withdraw-btn dim"
      @click="showToast('Los retiros estarán disponibles muy pronto.')"
    >
      Retiros disponibles pronto
    </button>
    <button
      v-else-if="!payout.connected || !payout.payoutsEnabled"
      class="withdraw-btn"
      :disabled="busy"
      @click="handleConnect"
    >
      {{ busy ? 'Abriendo…' : payout.connected ? 'Continuar verificación' : 'Conectar cuenta de retiro' }}
    </button>
    <button
      v-else
      class="withdraw-btn"
      :disabled="busy || earnedCoins < payout.minPayoutCoins"
      @click="handlePayout"
    >
      {{ busy ? 'Procesando…' : `Retirar (mín. ${payout.minPayoutCoins.toLocaleString()} 🪙)` }}
    </button>

    <p v-if="payout.configured" class="hint rate-hint">
      {{ payout.coinsPerUsd.toLocaleString() }} 🪙 = $1 USD · Comisión de
      retiro: {{ payout.payoutFeePercent }}% · El dinero llega a la cuenta
      bancaria que registres en Stripe (funciona con bancos de Perú y muchos
      otros países).
    </p>

    <p v-if="toast" class="toast">{{ toast }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import GlassBackButton from '../components/GlassBackButton.vue';
import { useAuth } from '../auth/useAuth';
import { getProfile } from '../data/profiles';
import {
  getPayoutStatus,
  connectPayoutAccount,
  requestPayout,
  buyCoinPack,
  verifyCoinPurchase,
  DEFAULT_PACKS,
  type PayoutStatus,
} from '../data/payouts';

const { user } = useAuth();
const route = useRoute();
const coins = ref(0);
const earnedCoins = ref(0);
const toast = ref('');
const packsSection = ref<HTMLElement | null>(null);

function scrollToPacks() {
  packsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const busy = ref(false);
const payout = ref<PayoutStatus>({
  configured: false,
  connected: false,
  coins: 0,
  earnedCoins: 0,
  coinsPerUsd: 200,
  minPayoutCoins: 2000,
  payoutFeePercent: 10,
  packs: DEFAULT_PACKS,
});

const payoutStatusLabel = computed(() => {
  if (!payout.value.configured) {
    return 'Próximamente';
  }
  if (!payout.value.connected) {
    return 'Sin conectar';
  }
  if (!payout.value.payoutsEnabled) {
    return 'Verificación pendiente';
  }
  return 'Lista ✓';
});

const estimatedUsd = computed(() =>
  (earnedCoins.value / (payout.value.coinsPerUsd || 200)).toFixed(2));
const estimatedNetUsd = computed(() => {
  const gross = earnedCoins.value / (payout.value.coinsPerUsd || 200);
  return (gross * (1 - (payout.value.payoutFeePercent || 0) / 100)).toFixed(2);
});

function showToast(text: string) {
  toast.value = text;
  window.setTimeout(() => { toast.value = ''; }, 4500);
}

async function refresh() {
  if (!user.value) {
    return;
  }
  try {
    const p: any = await getProfile(user.value.id);
    coins.value = p?.coins ?? 0;
    earnedCoins.value = p?.earned_coins ?? 0;
  } catch (error) {
    console.warn('[saldo] load failed:', error);
  }
  payout.value = await getPayoutStatus();
  if (payout.value.configured) {
    coins.value = payout.value.coins;
    earnedCoins.value = payout.value.earnedCoins;
    // Purchases recovered by the server-side reconciliation just now.
    if (payout.value.creditedNow) {
      showToast(`✅ Se acreditaron ${payout.value.creditedNow.toLocaleString()} 🪙 de compras pendientes.`);
    }
  }
}

async function handleBuy(packId: string) {
  busy.value = true;
  try {
    const url = await buyCoinPack(packId);
    window.location.href = url; // Stripe Checkout
  } catch (error: any) {
    showToast(error?.message || 'No se pudo iniciar la compra.');
    busy.value = false;
  }
}

async function handleConnect() {
  busy.value = true;
  try {
    const url = await connectPayoutAccount('PE');
    window.location.href = url; // Stripe's hosted onboarding
  } catch (error: any) {
    showToast(error?.message || 'No se pudo conectar con Stripe.');
    busy.value = false;
  }
}

async function handlePayout() {
  busy.value = true;
  try {
    const result = await requestPayout();
    showToast(result.message);
    if (result.ok) {
      await refresh();
    }
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  // Back from Stripe Checkout: credit the purchase (idempotent) BEFORE
  // loading balances so the new coins show immediately.
  const sid = route.query.sid as string | undefined;
  if (route.query.buy === 'success' && sid) {
    const result = await verifyCoinPurchase(sid).catch(
      () => ({ ok: false, message: 'No se pudo verificar la compra.' }),
    );
    showToast(result.message);
  } else if (route.query.buy === 'cancel') {
    showToast('Compra cancelada.');
  } else if (route.query.stripe === 'done') {
    showToast('Datos enviados a Stripe. La verificación puede tardar unos minutos.');
  } else if (route.query.stripe === 'retry') {
    showToast('Conexión interrumpida — toca de nuevo para continuar la verificación.');
  }
  await refresh();
});
</script>

<style scoped>
.saldo {
  /* Fixed height (not min-height): the app shell clips overflow, so the
     page must scroll INSIDE itself — min-height just grew past the shell
     and killed scrolling entirely. */
  height: 100%;
  padding: 54px 16px 40px;
  box-sizing: border-box;
  background: #010101;
  color: #fff;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.title {
  margin: 0 0 18px;
  text-align: center;
  font-size: 20px;
  font-weight: 800;
}
.balance-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 18px;
  border-radius: 22px;
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  box-shadow: 0 14px 40px rgba(139, 61, 255, 0.35);
  margin-bottom: 20px;
}
.bc-label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.9;
}
.bc-amount {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bc-gem { font-size: 30px; }
.bc-value {
  font-size: 44px;
  font-weight: 900;
  letter-spacing: 0.5px;
}
.bc-sub {
  font-size: 12px;
  opacity: 0.8;
  text-align: center;
}
.coins-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 13px 16px;
  margin-bottom: 20px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #121214;
  color: #fff;
  font-size: 14.5px;
  cursor: pointer;
}
.cp-coins strong { font-weight: 800; }
.cp-sep { color: rgba(255, 255, 255, 0.25); }
.cp-get { color: #c79bff; font-weight: 700; }
.section-title {
  margin: 0 4px 10px;
  font-size: 15px;
  font-weight: 800;
}
.packs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}
.pack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  border-radius: 16px;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  background: #121214;
  color: #fff;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.pack:active { border-color: #8b3dff; }
.pack:disabled { opacity: 0.55; }
.pack-coins {
  font-size: 16px;
  font-weight: 800;
}
.pack-price {
  font-size: 13px;
  color: #c79bff;
  font-weight: 700;
}
.group {
  background: #121214;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 16px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.row:last-child { border-bottom: none; }
.row-key { font-size: 14px; }
.row-val { font-size: 14px; font-weight: 700; }
.row-val.ok { color: #34c759; }
.hint {
  margin: 0 6px 18px;
  font-size: 13px;
  line-height: 1.5;
  color: #8a8a93;
}
.withdraw-btn {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 25px;
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
}
.withdraw-btn:disabled { opacity: 0.55; }
.withdraw-btn.dim { opacity: 0.55; }
.rate-hint { margin-top: 14px; text-align: center; }
.toast {
  margin-top: 14px;
  text-align: center;
  font-size: 13px;
  color: #c79bff;
}
</style>
