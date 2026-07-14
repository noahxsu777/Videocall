<template>
  <transition name="sheet">
    <div v-if="modelValue" class="sheet-backdrop" @click.self="close">
      <div class="sheet">
        <div class="sheet-grab" />
        <div class="sheet-title">Compartir transmisión</div>

        <div class="link-box">
          <span class="link-text">{{ shareUrl }}</span>
        </div>

        <button class="opt" @click="copyLink">
          <span class="opt-ic opt-ic-link">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l2.5-2.5a5 5 0 0 0-7.07-7.07L11 4.9"/><path d="M14 11a5 5 0 0 0-7.07 0l-2.5 2.5a5 5 0 0 0 7.07 7.07L13 19.1"/></svg>
          </span>
          <span class="opt-label">{{ copied ? '¡Copiado!' : 'Copiar enlace' }}</span>
        </button>

        <button class="opt" @click="shareWhatsApp">
          <span class="opt-ic opt-ic-wa">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 1 .9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.3.1-.5.1-.1.2-.3.4-.4.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.5-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 2 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.2-.2-.2-.5-.4Z"/></svg>
          </span>
          <span class="opt-label">Compartir por WhatsApp</span>
        </button>

        <button v-if="canNativeShare" class="opt" @click="shareNative">
          <span class="opt-ic opt-ic-more">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4"/></svg>
          </span>
          <span class="opt-label">Más opciones…</span>
        </button>

        <button class="sheet-cancel" @click="close">Cancelar</button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  liveId: string;
  hostName?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const copied = ref(false);

const shareUrl = computed(() => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/live-player?liveId=${encodeURIComponent(props.liveId)}`;
});

const shareText = computed(() =>
  `¡${props.hostName || 'Alguien'} está en vivo ahora! Míralo aquí: ${shareUrl.value}`);

const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

function close() {
  emit('update:modelValue', false);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
  } catch {
    // Fallback for browsers without Clipboard API permission.
    const el = document.createElement('textarea');
    el.value = shareUrl.value;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1800);
}

function shareWhatsApp() {
  const url = `https://wa.me/?text=${encodeURIComponent(shareText.value)}`;
  window.open(url, '_blank');
}

async function shareNative() {
  try {
    await navigator.share({ title: 'Transmisión en vivo', text: shareText.value, url: shareUrl.value });
  } catch {
    // User cancelled the native share sheet — no-op.
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
  margin-bottom: 14px;
}

.link-box {
  padding: 11px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 14px;
}
.link-text {
  display: block;
  font-size: 12.5px;
  color: #9a9aa2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, 'SF Mono', monospace;
}

.opt {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  background: none;
  border: none;
  border-top: 0.5px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  text-align: left;
}
.opt:first-of-type { border-top: none; }
.opt-ic {
  width: 32px;
  height: 32px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.opt-ic-link { background: linear-gradient(135deg, #0a84ff, #5e5ce6); }
.opt-ic-wa { background: #25d366; }
.opt-ic-more { background: #48484f; }

.sheet-cancel {
  width: 100%;
  height: 46px;
  margin-top: 12px;
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
