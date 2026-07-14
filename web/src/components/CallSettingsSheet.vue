<template>
  <transition name="sheet">
    <div v-if="modelValue" class="sheet-backdrop" @click.self="close">
      <div class="sheet">
        <div class="sheet-grab" />
        <div class="sheet-title">Tarifa de videollamadas</div>
        <p class="sheet-sub">
          Cuando alguien te llame, se le cobrarán estos coins por minuto.
        </p>

        <div class="rate-field">
          <span class="rate-coin">🪙</span>
          <input
            v-model.number="rate"
            type="number"
            min="0"
            step="10"
            class="rate-input"
          />
          <span class="rate-unit">/ min</span>
        </div>

        <div class="quick-rates">
          <button v-for="q in quickOptions" :key="q" class="quick-btn" :class="{ sel: rate === q }" @click="rate = q">
            {{ q }}
          </button>
        </div>

        <div class="balance-row">
          <span>Tu saldo actual</span>
          <span class="balance-val">🪙 {{ coins }}</span>
        </div>

        <p v-if="msg" class="msg" :class="ok ? 'ok' : 'err'">{{ msg }}</p>

        <button class="save-btn" :disabled="saving" @click="save">
          <span v-if="saving" class="spinner" />
          <span v-else>Guardar</span>
        </button>
        <button class="sheet-cancel" @click="close">Cerrar</button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuth } from '../auth/useAuth';
import { getCallRate, setCallRate, getCoins, DEFAULT_CALL_RATE } from '../data/calls';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const { user } = useAuth();

const rate = ref(DEFAULT_CALL_RATE);
const coins = ref(0);
const saving = ref(false);
const msg = ref('');
const ok = ref(false);
const quickOptions = [50, 100, 200, 500];

async function load() {
  if (!user.value) {
    return;
  }
  try {
    const [r, c] = await Promise.all([getCallRate(user.value.id), getCoins(user.value.id)]);
    rate.value = r;
    coins.value = c;
  } catch (error) {
    console.warn('[CallSettingsSheet] load failed:', error);
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      msg.value = '';
      load();
    }
  },
);

function close() {
  emit('update:modelValue', false);
}

async function save() {
  if (!user.value) {
    return;
  }
  saving.value = true;
  msg.value = '';
  try {
    await setCallRate(user.value.id, Math.max(0, rate.value || 0));
    ok.value = true;
    msg.value = 'Guardado ✓';
  } catch (error: any) {
    ok.value = false;
    msg.value = `No se pudo guardar: ${error?.message || 'error'}`;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0));
  background: rgba(28, 28, 32, 0.96);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  border-top: 0.5px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
}
.sheet-grab {
  width: 38px;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.25);
  margin: 4px auto 14px;
}
.sheet-title { text-align: center; font-size: 15px; font-weight: 700; }
.sheet-sub {
  margin: 6px 4px 16px;
  text-align: center;
  font-size: 12.5px;
  color: #9a9aa2;
  line-height: 1.5;
}

.rate-field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.rate-coin { font-size: 20px; }
.rate-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  -moz-appearance: textfield;
}
.rate-input::-webkit-outer-spin-button,
.rate-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.rate-unit { font-size: 13px; color: #8e8e93; }

.quick-rates {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.quick-btn {
  flex: 1;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
.quick-btn.sel {
  border-color: #ffcf5e;
  background: rgba(255, 207, 94, 0.14);
  color: #ffcf5e;
}

.balance-row {
  display: flex;
  justify-content: space-between;
  margin: 18px 4px 0;
  font-size: 13.5px;
  color: #9a9aa2;
}
.balance-val { color: #ffcf5e; font-weight: 700; }

.msg { margin: 12px 4px 0; font-size: 13px; text-align: center; }
.msg.ok { color: #34c759; }
.msg.err { color: #ff453a; }

.save-btn {
  width: 100%;
  height: 48px;
  margin-top: 16px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.save-btn:disabled { opacity: 0.6; }
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.sheet-cancel {
  width: 100%;
  height: 46px;
  margin-top: 8px;
  border-radius: 13px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
