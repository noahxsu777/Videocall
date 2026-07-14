<template>
  <transition name="sheet">
    <div v-if="modelValue" class="sheet-backdrop" @click.self="close">
      <div class="sheet">
        <div class="sheet-grab" />
        <div class="sheet-title">Configurar transmisión</div>

        <p class="group-label">Calidad de video</p>
        <div class="quality-grid">
          <button
            v-for="opt in resolutionList"
            :key="opt.value"
            class="quality-btn"
            :class="{ sel: currentResolution?.value === opt.value }"
            @click="pickResolution(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <p class="group-label">Pantalla</p>
        <button class="row" @click="togglePip">
          <span class="row-ic">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1" fill="#fff" stroke="none"/></svg>
          </span>
          <span class="row-label">Picture-in-Picture</span>
          <span class="switch" :class="{ on: isPictureInPicture }"><span class="knob" /></span>
        </button>

        <p v-if="errorMsg" class="err-msg">{{ errorMsg }}</p>

        <button class="sheet-cancel" @click="close">Listo</button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useLivePlayerState } from 'tuikit-atomicx-vue3';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const {
  resolutionList,
  currentResolution,
  switchResolution,
  isPictureInPicture,
  requestPictureInPicture,
  exitPictureInPicture,
} = useLivePlayerState();

const errorMsg = ref('');

function close() {
  emit('update:modelValue', false);
}

async function pickResolution(value: any) {
  errorMsg.value = '';
  try {
    await switchResolution(value);
  } catch (error: any) {
    errorMsg.value = 'No se pudo cambiar la calidad.';
    console.warn('[LiveQualitySheet] switchResolution failed:', error);
  }
}

async function togglePip() {
  errorMsg.value = '';
  try {
    if (isPictureInPicture.value) {
      await exitPictureInPicture();
    } else {
      await requestPictureInPicture();
    }
  } catch (error: any) {
    errorMsg.value = 'Picture-in-Picture no está disponible en este navegador.';
    console.warn('[LiveQualitySheet] PiP toggle failed:', error);
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
.sheet-title {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 6px;
}

.group-label {
  margin: 16px 4px 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #8e8e93;
}

.quality-grid {
  display: flex;
  gap: 8px;
}
.quality-btn {
  flex: 1;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.quality-btn.sel {
  border-color: #0a84ff;
  background: rgba(10, 132, 255, 0.18);
  color: #7fc4ff;
}

.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  background: none;
  border: none;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
.row-ic {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #5e5ce6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.row-label { flex: 1; text-align: left; }

.switch {
  width: 46px;
  height: 27px;
  border-radius: 14px;
  background: #39393d;
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s ease;
}
.switch.on { background: #34c759; }
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 23px;
  height: 23px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}
.switch.on .knob { transform: translateX(19px); }

.err-msg {
  margin: 12px 4px 0;
  font-size: 12.5px;
  color: #ff6f8b;
  text-align: center;
}

.sheet-cancel {
  width: 100%;
  height: 46px;
  margin-top: 16px;
  border-radius: 13px;
  border: none;
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
