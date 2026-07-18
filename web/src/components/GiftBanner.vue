<template>
  <div class="gift-banner">
    <transition-group name="gift-pop">
      <div v-for="g in visible" :key="g.id" class="gift-card">
        <img v-if="g.avatar" :src="g.avatar" class="gift-avatar" alt="" @error="g.avatar = ''" />
        <div v-else class="gift-avatar gift-avatar-fallback">{{ g.initial }}</div>
        <div class="gift-info">
          <span class="gift-sender">{{ g.sender }}</span>
          <span class="gift-desc">envió {{ g.name }}<span v-if="g.count > 1"> ×{{ g.count }}</span></span>
        </div>
        <img v-if="g.icon" class="gift-icon" :src="g.icon" alt="" @error="g.icon = ''" />
        <span v-else class="gift-icon gift-icon-fallback">🎁</span>
        <span class="gift-diamonds">💎 {{ g.diamonds.toLocaleString() }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import { useLiveGiftState, LiveGiftEvents } from 'tuikit-atomicx-vue3';

interface GiftCard {
  id: number;
  sender: string;
  initial: string;
  avatar: string;
  name: string;
  icon: string;
  count: number;
  diamonds: number;
}

const { subscribeEvent, unsubscribeEvent } = useLiveGiftState();
const visible = ref<GiftCard[]>([]);
let seq = 0;

// De-dupe: the SDK can deliver the same gift event more than once (a local
// echo to the sender plus the broadcast, or a re-emit), which showed the
// same gift banner twice. Track recently-seen message keys and ignore
// repeats within a short window.
const seen = new Map<string, number>();
const DEDUPE_MS = 4000;

function giftKey(info: any, gift: any, sender: string, count: number): string {
  // Prefer a real message id when the SDK provides one; otherwise fall back
  // to a composite key bucketed to ~1s so an accidental double-emit of the
  // same gift collapses but two genuine sends a second apart don't.
  const msgId = info?.messageId || info?.messageID || info?.ID || info?.id;
  if (msgId) {
    return String(msgId);
  }
  const giftId = gift?.giftId || gift?.id || gift?.name || 'g';
  return `${sender}|${giftId}|${count}|${Math.floor(Date.now() / 1000)}`;
}

function onGift(info: any) {
  const gift = info?.giftInfo || {};
  const count = info?.giftCount || 1;
  const sender = info?.sender?.userName || info?.sender?.userId || 'Alguien';

  const key = giftKey(info, gift, sender, count);
  const now = Date.now();
  // Purge stale keys so the map doesn't grow forever.
  for (const [k, t] of seen) {
    if (now - t > DEDUPE_MS) {
      seen.delete(k);
    }
  }
  if (seen.has(key)) {
    return; // duplicate of a gift we just showed
  }
  seen.set(key, now);

  const id = ++seq;
  const card = reactive<GiftCard>({
    id,
    sender,
    initial: sender.slice(0, 1).toUpperCase(),
    avatar: info?.sender?.avatarUrl || '',
    name: gift.name || 'un regalo',
    icon: gift.iconUrl || gift.imageUrl || gift.resourceUrl || gift.animationUrl || '',
    count,
    // "diamonds" = the gift's coin value from the Tencent catalog × count.
    diamonds: (gift.coins || 0) * count,
  });
  visible.value.push(card);
  // Keep at most 4 on screen; auto-dismiss each after a few seconds.
  if (visible.value.length > 4) {
    visible.value.shift();
  }
  window.setTimeout(() => {
    visible.value = visible.value.filter(x => x.id !== id);
  }, 4500);
}

onMounted(() => {
  subscribeEvent(LiveGiftEvents.ON_RECEIVE_GIFT_MESSAGE, onGift);
});
onUnmounted(() => {
  unsubscribeEvent(LiveGiftEvents.ON_RECEIVE_GIFT_MESSAGE, onGift);
});
</script>

<style scoped>
.gift-banner {
  position: absolute;
  left: 12px;
  bottom: 150px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.gift-card {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 78vw;
  padding: 6px 12px 6px 6px;
  border-radius: 22px;
  background: linear-gradient(90deg, rgba(255, 61, 129, 0.85), rgba(155, 45, 247, 0.7));
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  color: #fff;
}

.gift-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1.5px solid rgba(255, 255, 255, 0.6);
}
.gift-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  font-size: 15px;
  font-weight: 700;
}

.gift-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}
.gift-sender {
  font-size: 13px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gift-desc {
  font-size: 11.5px;
  opacity: 0.92;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gift-icon {
  width: 30px;
  height: 30px;
  object-fit: contain;
  flex-shrink: 0;
}
.gift-icon-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.gift-diamonds {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.28);
  white-space: nowrap;
}

.gift-pop-enter-active {
  transition: transform 0.35s cubic-bezier(0.2, 1.2, 0.3, 1), opacity 0.35s ease;
}
.gift-pop-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.gift-pop-enter-from {
  transform: translateX(-40px) scale(0.85);
  opacity: 0;
}
.gift-pop-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}
</style>
