<template>
  <div class="saldo">
    <GlassBackButton />
    <h1 class="title">Saldo</h1>

    <!-- Earnings card: everything the creator earns from streaming -->
    <div class="balance-card">
      <span class="bc-label">Ganancias de tus transmisiones</span>
      <div class="bc-amount">
        <span class="bc-gem">💎</span>
        <span class="bc-value">{{ diamonds.toLocaleString() }}</span>
      </div>
      <span class="bc-sub">diamantes recibidos en regalos</span>
    </div>

    <section class="group">
      <div class="row">
        <span class="row-key">🪙 Monedas (coins)</span>
        <span class="row-val">{{ coins.toLocaleString() }}</span>
      </div>
      <div class="row">
        <span class="row-key">💎 Diamantes ganados</span>
        <span class="row-val">{{ diamonds.toLocaleString() }}</span>
      </div>
    </section>

    <p class="hint">
      Aquí se acumulan todas las ganancias que generas como creador cuando
      transmites: cada regalo que recibes en un live suma sus diamantes a tu
      saldo automáticamente.
    </p>

    <button class="withdraw-btn" @click="showToast('El retiro de ganancias estará disponible pronto.')">
      Retirar ganancias
    </button>

    <p v-if="toast" class="toast">{{ toast }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import GlassBackButton from '../components/GlassBackButton.vue';
import { useAuth } from '../auth/useAuth';
import { getProfile } from '../data/profiles';

const { user } = useAuth();
const coins = ref(0);
const diamonds = ref(0);
const toast = ref('');

function showToast(text: string) {
  toast.value = text;
  window.setTimeout(() => { toast.value = ''; }, 2600);
}

onMounted(async () => {
  if (!user.value) {
    return;
  }
  try {
    const p: any = await getProfile(user.value.id);
    coins.value = p?.coins ?? 0;
    // Column added by the diamonds-earned migration; 0 until it's run.
    diamonds.value = p?.diamonds_earned ?? 0;
  } catch (error) {
    console.warn('[saldo] load failed:', error);
  }
});
</script>

<style scoped>
.saldo {
  min-height: 100%;
  padding: 68px 16px 32px;
  box-sizing: border-box;
  background: #010101;
  color: #fff;
  overflow-y: auto;
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
  margin-bottom: 18px;
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
.row-key { font-size: 15px; }
.row-val { font-size: 15px; font-weight: 700; }
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
.toast {
  margin-top: 14px;
  text-align: center;
  font-size: 13px;
  color: #c79bff;
}
</style>
