<template>
  <!--
    The is-mobile class (user-agent based, orientation-independent)
    gates the full-screen mobile styling — a width media query alone
    missed phones held in landscape, which fell back to the desktop
    3-column studio layout.
  -->
  <div
    id="live-pusher-view"
    class="live-pusher-main"
    :class="{ 'is-mobile': isMobile, 'is-battle': isMobile && isBattle }"
    :style="{ '--cam-filter': camFilter }"
  >
    <!--
      Defer mounting the entire pusher subtree until the WebRTC
      capability probe has passed. Without this gate, an unsupported
      browser would still trigger LiveScenePanel / StreamMixer /
      LiveAudienceList side-effects (camera preview init, etc.) before
      the parent reacted to leaveLive. The TUIDialog below is left
      out of the gate on purpose: it is dormant by default
      (exitLiveDialogVisible === false) and has no RTC side-effect.
    -->
    <template v-if="rtcSupportChecked">
      <div class="main-left">
      <div class="main-left-top">
        <div class="main-left-top-title card-title">
          <div class="title-text">
            <IconArrowStrokeBack class="icon-back" size="20" @click="handleLeaveLive" />
            {{ t('Video Source') }}
          </div>
        </div>
        <!--
          On mobile the camera starts automatically (see
          startMobileCameraPreview / publishMobileCamera), so the manual source picker
          (Add Camera / Screen / Image) is desktop-only.
        -->
        <LiveScenePanel v-if="!isMobile" />
      </div>
      <div class="main-left-bottom">
        <div class="main-left-bottom-header">
          <div class="main-left-bottom-title">
            {{ t('Live tool') }}
          </div>
          <div
            class="main-left-bottom-fold"
            @click="isToolsExpanded = !isToolsExpanded"
          >
            <IconArrowStrokeSelectDown
              class="arrow-icon"
              :class="{ expanded: isToolsExpanded, collapsed: !isToolsExpanded }"
            />
            <span>{{ isToolsExpanded ? t('Close') : t('Expand') }}</span>
          </div>
        </div>
        <div
          v-show="isToolsExpanded"
          class="main-left-bottom-tools"
        >
          <CoGuestButton />
          <CoHostButton />
        </div>
      </div>
    </div>
    <div class="main-center" @touchstart.passive="onLiveTouchStart" @touchend.passive="onLiveTouchEnd">
      <div class="main-center-top">
        <div class="main-center-top-left">
          {{ currentLive?.liveName || liveParams.liveName }}
          <LiveSettingButton
            v-if="loginUserInfo?.userId"
            ref="liveSettingButtonRef"
            :live-name="currentLive?.liveName || liveParams.liveName"
            :cover-url="currentLive?.coverUrl || liveParams.coverUrl"
            @confirm="handleLiveSettingConfirm"
          />
          <IconCopy
            v-if="loginUserInfo?.userId"
            class="copy-icon"
            size="16"
            @click="handleCopyLiveID"
          />
        </div>
        <div class="main-center-top-right">
          <span class="watching-count">{{ audienceCount }} {{ t('People watching') }}</span>
          <!-- On mobile, End live lives up here as a small pill next to the
               viewer count, freeing the bottom row for the creator tools
               (co-guest / co-host / battles / modos). -->
          <button
            v-if="isMobile && isInLive"
            class="top-end-live"
            :disabled="loading"
            @click="showEndLiveDialog"
          >
            {{ t('End live') }}
          </button>
        </div>
      </div>
      <!-- Live stats (host): time on air + total diamonds received. -->
      <div v-if="isMobile && isInLive" class="live-stats">
        <span class="live-stat live-stat-time">⏱ {{ liveElapsedText }}</span>
        <span class="live-stat live-stat-diamonds">🪙 {{ diamondsReceived.toLocaleString() }}</span>
      </div>
      <div class="main-center-center">
        <!--
          StreamMixer is built on TRTC's VideoMixer plugin, which hard-
          throws ENV_NOT_SUPPORTED on mobile browsers ("VideoMixer is
          not supported on mobile devices currently"). On mobile we use
          plain LiveCoreView + openLocalCamera() instead — the exact
          path mobile co-hosts/co-guests already publish through.
        -->
        <LiveCoreView v-if="isMobile" />
        <StreamMixer v-else />
        <!--
          Pre-live camera preview (mobile only). We render our own
          getUserMedia stream with EXPLICIT portrait constraints into
          this <video> — the SDK's startCameraTest takes no constraints
          and always captures landscape, which showed up as a
          letterboxed strip instead of an Instagram-style full-bleed
          vertical preview. Hidden once live starts and the published
          feed takes over.
        -->
        <div
          v-show="isMobile && !isCameraOff && !hasOthersOnScreen"
          class="mobile-camera-preview"
        >
          <video
            :id="MOBILE_PREVIEW_VIEW_ID"
            :style="camVideoStyle"
            autoplay
            playsinline
            muted
          />
        </div>
      </div>
      <!--
        Mobile-only floating camera controls: flip front/rear, mirror,
        basic filters, and toggle the camera off/on. Work both pre-live
        (our preview stream) and in-live (engine switch / close+republish).
      -->
      <div v-if="isMobile" class="mobile-camera-actions" :class="{ 'shifted-down': !isInLive }">
        <div class="camera-action-btn" :class="{ 'is-off': isCameraOff }" @click="toggleMobileCameraOff">
          <IconCameraOn v-if="!isCameraOff" size="22" />
          <IconCameraOff v-else size="22" />
        </div>
        <div class="camera-action-btn" @click="toggleMobileCameraFacing">
          <IconCameraSwitch size="22" />
        </div>
        <div class="camera-action-btn" :class="{ 'is-on': isMirrored }" @click="isMirrored = !isMirrored">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M8 7 4 12l4 5"/><path d="m16 7 4 5-4 5"/></svg>
        </div>
        <div v-if="isInLive" class="camera-action-btn" :class="{ 'is-on': camFilter !== 'none' }" @click="filterPickerVisible = !filterPickerVisible">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 9v6l8 6 8-6V9z"/><path d="M12 3v18M4 9l16 0"/></svg>
        </div>
      </div>
      <!-- Tango-style pre-live action stack: effects, share, settings.
           Only shown before the creator taps "Iniciar directo" — once
           live, the controls above take over the same screen corner. -->
      <div v-if="isMobile && !isInLive" class="pre-live-actions">
        <button class="pre-live-action-btn" :class="{ 'is-on': camFilter !== 'none' }" @click="filterPickerVisible = !filterPickerVisible">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M12 2 13.8 8.2 20 10 13.8 11.8 12 18 10.2 11.8 4 10 10.2 8.2 12 2Z"/><path d="M19 14 19.9 16.6 22.5 17.5 19.9 18.4 19 21 18.1 18.4 15.5 17.5 18.1 16.6 19 14Z"/></svg>
        </button>
        <button class="pre-live-action-btn" @click="preLiveShareOpen = true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 7 5 5-5 5"/><path d="M22 12H9a5 5 0 0 0-5 5v1"/></svg>
        </button>
        <button class="pre-live-action-btn" @click="settingButtonRef?.open?.()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
        </button>
      </div>
      <ShareLiveSheet
        v-if="isMobile"
        v-model="preLiveShareOpen"
        :live-id="liveParams.liveId"
        :host-name="authDisplayName"
      />
      <!-- Basic filter picker (host-side look; see CAMERA_FILTERS note) -->
      <div v-if="isMobile && filterPickerVisible" class="filter-picker">
        <button
          v-for="f in CAMERA_FILTERS"
          :key="f.value"
          class="filter-chip"
          :class="{ active: camFilter === f.value }"
          @click="selectFilter(f.value)"
        >
          {{ f.name }}
        </button>
      </div>
      <!--
        Mobile-only viewer messages. In battle/co-host mode the camera
        tiles are lifted to the top (see .is-battle CSS) and these
        messages fill the space beneath them; in solo mode they float
        TikTok-style over the lower part of the video.
      -->
      <div v-if="isMobile && isInLive" class="mobile-barrage">
        <LiveChat :is-host="true" @open-user="onOpenChatUser" />
      </div>
      <!-- Received-gift display: use Tencent's OWN gift UI (with the
           sender's avatar), the same the viewers see. LiveGift renders a
           "send gift" button plus a GiftCardPlayer that it Teleports to
           #app; the host shouldn't send gifts to their own live, so we
           hide this wrapper (display:none) — that only hides the button,
           the teleported receive display still shows app-wide. -->
      <div v-if="isInLive" class="host-gift-receiver"><LiveGift /></div>

      <!-- End-of-live recap: time on air, coins earned, viewers. -->
      <div v-if="endSummary" class="end-summary-backdrop">
        <div class="end-summary">
          <h3 class="es-title">Transmisión finalizada</h3>
          <div class="es-grid">
            <div class="es-card">
              <span class="es-ico">⏱</span>
              <span class="es-val">{{ endSummary.duration }}</span>
              <span class="es-lbl">En vivo</span>
            </div>
            <div class="es-card">
              <span class="es-ico">👁</span>
              <span class="es-val">{{ endSummary.viewers }}</span>
              <span class="es-lbl">Viewers</span>
            </div>
            <div class="es-card es-card-coins">
              <span class="es-ico">🪙</span>
              <span class="es-val">{{ endSummary.coins.toLocaleString() }}</span>
              <span class="es-lbl">Coins ganados</span>
            </div>
          </div>
          <p class="es-note">≈ ${{ (endSummary.coins / 200).toFixed(2) }} USD añadidos a tu Saldo, listos para retirar. 🎉</p>
          <button class="es-close" @click="endSummary = null">Cerrar</button>
        </div>
      </div>

      <!-- Swipe-left stats panel (host): live stats + diamonds + a nudge to
           keep streaming more hours. -->
      <template v-if="isMobile && isInLive">
        <div v-if="statsPanelOpen" class="stats-backdrop" @click="statsPanelOpen = false" />
        <transition name="stats-slide">
          <aside v-if="statsPanelOpen" class="stats-panel">
            <h3 class="stats-title">Tu transmisión</h3>
            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-ico">⏱</span>
                <span class="stat-val">{{ liveElapsedText }}</span>
                <span class="stat-lbl">En vivo</span>
              </div>
              <div class="stat-card">
                <span class="stat-ico">👁</span>
                <span class="stat-val">{{ audienceCount }}</span>
                <span class="stat-lbl">Viendo</span>
              </div>
              <div class="stat-card stat-card-diamonds">
                <span class="stat-ico">🪙</span>
                <span class="stat-val">{{ diamondsReceived.toLocaleString() }}</span>
                <span class="stat-lbl">Coins</span>
              </div>
            </div>
            <div class="stats-encourage">
              <span class="enc-emoji">✨</span>
              <p>{{ encourageMessage }}</p>
            </div>
            <p class="stats-hint">Desliza a la derecha para cerrar →</p>
          </aside>
        </transition>
      </template>

      <div class="main-center-bottom">
        <!-- Tango-style pre-live card: cover thumbnail + notification
             message sent to followers when the live actually starts. -->
        <div v-if="isMobile && !isInLive" class="pre-live-card">
          <button class="pre-live-cover" :disabled="preLiveCoverUploading" @click="preLiveCoverInputRef?.click()">
            <img v-if="liveParams.coverUrl" :src="liveParams.coverUrl" alt="" />
            <span v-else class="pre-live-cover-placeholder">🎬</span>
            <span class="pre-live-cover-edit">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </span>
          </button>
          <input
            ref="preLiveCoverInputRef"
            type="file"
            accept="image/*"
            hidden
            @change="onPreLiveCoverSelected"
          >
          <div class="pre-live-notify">
            <span class="pre-live-notify-label">Notificación para los seguidores</span>
            <input
              v-model="liveStartMessage"
              class="pre-live-notify-input"
              type="text"
              maxlength="120"
              placeholder="Inicié la transmisión"
            />
          </div>
        </div>
        <div class="main-center-bottom-content">
          <div class="main-center-bottom-left">
            <div class="main-center-bottom-tools">
              <MicVolumeSetting />
              <SpeakerVolumeSetting />
              <CoGuestButton />
              <CoHostButton />
              <LayoutSwitch />
              <SettingButton ref="settingButtonRef" />
            </div>
          </div>
          <div class="main-center-bottom-right">
            <TUIButton
              v-if="!isInLive"
              type="primary"
              :disabled="loading"
              @click="handleStartLive"
            >
              <IconLiveLoading
                v-if="loading"
                class="loading-icon"
              />
              <IconLiveStart v-else />
              {{ t('Start live') }}
            </TUIButton>
            <TUIButton
              v-else-if="!isMobile"
              color="red"
              :disabled="loading"
              @click="showEndLiveDialog"
            >
              <IconLiveLoading
                v-if="loading"
                class="loading-icon"
              />
              <IconEndLive v-else />
              {{ t('End live') }}
            </TUIButton>
          </div>
        </div>
      </div>
    </div>
    <div class="main-right">
      <div class="main-right-top">
        <div class="main-right-top-title card-title">
          <div class="title-text">
            {{ t('Online viewers') }}
          </div>
          <div class="title-count">({{ audienceCount }})</div>
        </div>
        <LiveAudienceList height="calc(100% - 40px)" />
      </div>
      <div class="main-right-bottom">
        <div class="main-right-bottom-header">
          <div class="main-right-bottom-title card-title">
            {{ t('Barrage list') }}
          </div>
        </div>
        <div class="message-list-container">
          <BarrageList />
        </div>
        <div class="message-input-container">
          <BarrageInput
            height="56px"
            :disabled="!isInLive"
            :placeholder="isInLive ? '' : t('Live not started')"
          />
        </div>
      </div>
    </div>
    <LivePusherNotification />
    <UserActionSheet v-model="chatUserSheet" :target="chatUserTarget" />
    </template>
    <TUIDialog
      v-model:visible="exitLiveDialogVisible"
      :title="t('End live')"
    >
      {{ endLiveDialogMessage }}
      <template #footer>
        <div class="action-buttons">
          <TUIButton
            color="gray"
            @click="exitLiveDialogVisible = false"
          >
            {{ t('Cancel') }}
          </TUIButton>
          <TUIButton
            color="red"
            @click="handleEndLive"
          >
            {{ t('End live') }}
          </TUIButton>
          <TUIButton
            v-if="coHostStatus === CoHostStatus.Connected && !currentBattleInfo?.battleId"
            type="primary"
            color="red"
            @click="handleExitConnection"
          >
            {{ t('Exit connection') }}
          </TUIButton>
          <TUIButton
            v-if="currentBattleInfo?.battleId"
            type="primary"
            color="red"
            @click="handleExitBattle"
          >
            Salir de la batalla
          </TUIButton>
        </div>
      </template>
    </TUIDialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import TUIRoomEngine, {
  TUISeatMode,
  TRTCVideoFillMode,
  TRTCVideoRotation,
  TRTCVideoMirrorType,
  TRTCVideoEncParam,
  TRTCVideoResolution,
  TRTCVideoResolutionMode,
} from '@tencentcloud/tuiroom-engine-js';
import {
  IconArrowStrokeBack,
  TUIDialog,
  TUIButton,
  useUIKit,
  TUIToast,
  IconLiveStart,
  IconEndLive,
  IconLiveLoading,
  IconArrowStrokeSelectDown,
  IconCopy,
  IconCameraOn,
  IconCameraOff,
  IconCameraSwitch,
} from '@tencentcloud/uikit-base-component-vue3';
import {
  LiveScenePanel,
  LiveAudienceList,
  BarrageList,
  BarrageInput,
  useBarrageState,
  useLiveListState,
  useLiveAudienceState,
  useLoginState,
  StreamMixer,
  LiveCoreView,
  LiveGift,
  useDeviceState,
  useCoHostState,
  useBattleState,
  CoHostStatus,
  useCoGuestState,
  useRoomEngine,
  UIKitModal,
  LiveListEvent,
  LiveEndedReason,
  LiveListEventInfo,
  BarrageEvent,
  Barrage,
  useLiveGiftState,
  LiveGiftEvents,
} from 'tuikit-atomicx-vue3';
import CoGuestButton from './component/CoGuestButton.vue';
import CoHostButton from './component/CoHostButton.vue';
import LayoutSwitch from './component/LayoutSwitch.vue';
import LiveSettingButton from './component/LiveSettingButton.vue';
import MicVolumeSetting from './component/MicVolumeSetting.vue';
import SettingButton from './component/SettingButton.vue';
import SpeakerVolumeSetting from './component/SpeakerVolumeSetting.vue';
import LivePusherNotification from './component/LivePusherNotification.vue';
import LiveChat from '../components/LiveChat.vue';
import UserActionSheet, { type SheetTarget } from '../components/UserActionSheet.vue';
import ShareLiveSheet from '../components/ShareLiveSheet.vue';
import { useAuth } from '../auth/useAuth';
import { notifyLiveStarted, addEarnedCoins, uploadCover } from '../data/profiles';
import { UPLOAD_ALLOWED_MIME_TYPES, UPLOAD_MAX_FILE_SIZE_MB } from '../api/upload';
import { recordLiveSession } from '../data/stats';
import { copyToClipboard, isSvgCoverUrl } from './utils/utils';
import { errorHandler } from './utils/errorHandler';
import { initRoomEngineLanguage } from '../utils/utils';
import { useWebRTCSupportGuard } from './utils/webrtcSupport';
import { isMobile } from './utils/environment';
import { TUISeatLayoutTemplate } from './types/LivePusher';

const { t } = useUIKit();
const props = defineProps<{
  liveId?: string;
  liveName?: string;
  seatMode?: TUISeatMode;
}>();

const emit = defineEmits(['leaveLive']);

// WebRTC capability guard — pusher role.
// The pusher page has nothing useful to do when the browser cannot
// push video. The guard shows a toast recommending Chrome and the
// page is unwound via the existing leaveLive channel.
const { guardLiveEntry } = useWebRTCSupportGuard();

// Toggled to true only after the probe resolves AND the pusher is
// allowed to proceed. The template's outer `v-if` reads this flag
// so the entire pusher subtree (LiveScenePanel / StreamMixer /
// LiveAudienceList / etc.) is never mounted on unsupported browsers,
// avoiding wasted camera preview initialization and SDK error logs
// during the probe-then-leave window.
const rtcSupportChecked = ref(false);
let autoStartCameraFallbackTimer: number | null = null;

const isToolsExpanded = ref(true);
const exitLiveDialogVisible = ref(false);
const { loginUserInfo } = useLoginState();
// Real display name from the Supabase account — used for the live title
// so the screen never shows the raw Tencent u_xxx id, even when the
// Tencent-side profile hasn't synced yet.
const { displayName: authDisplayName, user: authUser } = useAuth();
const { currentLive, startLive, endLive, joinLive, subscribeEvent: subscribeLiveListEvent, unsubscribeEvent: unsubscribeLiveListEvent, updateLiveInfo } = useLiveListState();
const roomEngine = useRoomEngine();
const { audienceCount } = useLiveAudienceState();
const {
  openLocalMicrophone,
  openLocalCamera,
  closeLocalCamera,
  switchCamera,
} = useDeviceState();
const { coHostStatus, connected: coHostConnectedUsers, exitHostConnection } = useCoHostState();
const { currentBattleInfo, exitBattle } = useBattleState();
const { connected: coGuestConnected } = useCoGuestState();
const { subscribeEvent: subscribeBarrageEvent, unsubscribeEvent: unsubscribeBarrageEvent} = useBarrageState();

const isInLive = computed(() => !!currentLive.value?.liveId);

// True when someone OTHER than the host is on screen — a co-host/battle
// partner, OR one or more co-guests who took a seat (the "Apply to Link"
// grid). In all these cases the host must see TRTC's multi-tile
// LiveCoreView (same as viewers), NOT their own solo camera overlay —
// otherwise the host "stays alone" while everyone else sees the grid.
const hasOthersOnScreen = computed(
  () => coHostStatus.value === CoHostStatus.Connected || coGuestConnected.value.length > 1,
);
// Battle / co-host connected: on mobile we lift the two camera tiles up
// and open a viewer-message area beneath them (see .is-battle CSS).
const isBattle = computed(() => coHostStatus.value === CoHostStatus.Connected);

// --- Live stats: time on air + total diamonds received --------------------
const { subscribeEvent: subscribeGiftEvent, unsubscribeEvent: unsubscribeGiftEvent } = useLiveGiftState();
const liveElapsed = ref(0);
const diamondsReceived = ref(0);
let liveTimerId = 0;
const liveElapsedText = computed(() => {
  const total = liveElapsed.value;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
});
function onGiftForStats(info: any) {
  const gift = info?.giftInfo || {};
  const count = info?.giftCount || 1;
  const value = (gift.coins || 0) * count;
  diamondsReceived.value += value;
  // Persist the earnings onto the creator's profile (Saldo screen).
  void addEarnedCoins(value);
}

// --- Swipe-left stats panel (host) ---------------------------------------
// Swiping left over the live opens a panel with the session stats +
// diamonds and a message nudging the creator to keep streaming (more hours
// = more reach / rewards). Swipe right or tap the backdrop closes it.
const statsPanelOpen = ref(false);
let swipeStartX = 0;
let swipeStartY = 0;
function onLiveTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) {
    return;
  }
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
}
function onLiveTouchEnd(e: TouchEvent) {
  if (!isInLive.value) {
    return;
  }
  const t = e.changedTouches[0];
  if (!t) {
    return;
  }
  const dx = t.clientX - swipeStartX;
  const dy = t.clientY - swipeStartY;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
    statsPanelOpen.value = dx < 0; // swipe left = open, right = close
  }
}

// Motivational nudge that ramps up with the streamed time. Encourages the
// creator to rack up live hours.
const encourageMessage = computed(() => {
  const min = Math.floor(liveElapsed.value / 60);
  if (min < 15) {
    return '¡Acabas de empezar! Las primeras horas son las que más te hacen crecer. 🚀';
  }
  if (min < 60) {
    return `Llevas ${min} min en vivo. Sigue: mientras más tiempo transmites, más gente te descubre. 🔥`;
  }
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return `¡${h}h ${rem}min al aire! Eres de los creadores dedicados — sigue sumando horas para subir de nivel y ganar más 🪙.`;
});
watch(isInLive, (inLive) => {
  window.clearInterval(liveTimerId);
  if (inLive) {
    liveElapsed.value = 0;
    liveTimerId = window.setInterval(() => { liveElapsed.value += 1; }, 1000);
    subscribeGiftEvent(LiveGiftEvents.ON_RECEIVE_GIFT_MESSAGE, onGiftForStats);
  } else {
    diamondsReceived.value = 0;
    unsubscribeGiftEvent(LiveGiftEvents.ON_RECEIVE_GIFT_MESSAGE, onGiftForStats);
  }
});
onUnmounted(() => {
  window.clearInterval(liveTimerId);
  unsubscribeGiftEvent(LiveGiftEvents.ON_RECEIVE_GIFT_MESSAGE, onGiftForStats);
});

// Tapping a chat author opens the follow/message sheet.
const chatUserSheet = ref(false);
const chatUserTarget = ref<SheetTarget | null>(null);
const onOpenChatUser = (target: SheetTarget) => {
  chatUserTarget.value = target;
  chatUserSheet.value = true;
};
// Back to the pre-live state (live ended) → bring the preview back.
watch(isInLive, (inLive) => {
  if (!inLive && !isCameraOff.value) {
    startMobileCameraPreview();
  }
});

// TikTok-style battle/co-host layout on mobile. When a host connection
// forms, the engine switches the room to its landscape 2-seat template
// (400) — on a phone that renders as a short letterboxed strip in the
// middle of the screen. Override it with a CUSTOM layout (LayoutMode
// 1000): portrait canvas with both feeds as tall half-width tiles
// pinned to the top of the screen, right under the top bar.
const applyMobileBattleLayout = async () => {
  const liveId = currentLive.value?.liveId;
  if (!isMobile || !liveId) {
    return;
  }
  const selfId = loginUserInfo.value?.userId;
  const members: { userId: string; liveId?: string }[] =
    (coHostConnectedUsers.value || []).map((user: any) => ({
      userId: user.userId,
      liveId: user.liveId || user.roomId,
    }));
  if (selfId && !members.some(member => member.userId === selfId)) {
    members.unshift({ userId: selfId, liveId });
  } else if (selfId) {
    // Self on the left, like TikTok.
    members.sort((a, b) => (a.userId === selfId ? -1 : b.userId === selfId ? 1 : 0));
  }
  if (members.length < 2) {
    return;
  }
  // Canvas exactly the size of the two tiles (no dead space below) so
  // LiveCoreView can fill the on-screen container edge to edge.
  const canvasWidth = 720;
  const canvasHeight = 640;
  const tileWidth = canvasWidth / 2;
  const tileHeight = canvasHeight; // two 9:16 halves side by side
  const layout = {
    VideoEncode: { Width: canvasWidth, Height: canvasHeight },
    LayoutMode: 1000,
    LayoutInfo: {
      LayoutList: members.slice(0, 2).map((member, index) => ({
        LocationX: index * tileWidth,
        LocationY: 0,
        ImageWidth: tileWidth,
        ImageHeight: tileHeight,
        ZOrder: 1,
        StreamType: 0,
        Member_Account: member.userId,
        RoomId: member.liveId || liveId,
        BackgroundColor: '0x000000',
      })),
    },
  };
  try {
    await (roomEngine.instance as any)?.getLiveLayoutManager?.()?.setLiveStreamLayoutInfo(
      liveId,
      JSON.stringify(layout),
    );
  } catch (error) {
    console.warn('[LivePusherView] custom battle layout failed:', error);
  }
};

watch(
  [coHostStatus, () => (coHostConnectedUsers.value || []).length],
  ([status], [prevStatus]) => {
    if (!isMobile) {
      return;
    }
    if (status === CoHostStatus.Connected) {
      // Battle/co-host: drop our own self-view overlay so TRTC's tiles
      // (which show both participants) are visible, and apply our
      // custom stacked layout. The engine applies its own LANDSCAPE
      // template when the connection forms — on a phone that flips the
      // whole screen to a horizontal strip, which the user never asked
      // for. Force the room back to a PORTRAIT seat template so the local
      // render stays vertical, then apply our custom stacked layout for
      // the mixed/CDN stream. Re-apply on a delay to beat the server echo
      // that re-sends the landscape template right after connecting.
      stopMobileCameraPreview();
      const keepPortrait = () => {
        if (coHostStatus.value === CoHostStatus.Connected) {
          void updateLiveInfo({ layoutTemplate: TUISeatLayoutTemplate.PortraitDynamic_Grid9 });
        }
      };
      keepPortrait();
      applyMobileBattleLayout();
      setTimeout(() => { keepPortrait(); applyMobileBattleLayout(); }, 500);
      setTimeout(() => { keepPortrait(); applyMobileBattleLayout(); }, 2000);
    } else if (prevStatus === CoHostStatus.Connected && status === CoHostStatus.Disconnected) {
      // Back to solo: restore the portrait grid template and bring our
      // own self-view overlay back.
      updateLiveInfo({ layoutTemplate: TUISeatLayoutTemplate.PortraitDynamic_Grid9 });
      startMobileCameraPreview();
    }
  },
);
// Co-guests joining/leaving a seat (the "Apply to Link" grid) must flip the
// host between their solo camera overlay and TRTC's multi-tile grid, the
// same way the co-host watch above does — otherwise the host keeps seeing
// only themselves while viewers see the full grid.
watch(hasOthersOnScreen, (others) => {
  if (!isMobile) {
    return;
  }
  if (others) {
    stopMobileCameraPreview();
  } else if (isInLive.value) {
    startMobileCameraPreview();
  }
});

const loading = ref(false);
const liveParamsEditForm = ref({
  liveName: '',
  coverUrl: '',
});
const liveParams = computed(() => ({
  liveId: props.liveId || `live_${loginUserInfo.value?.userId}`,
  liveName:
    liveParamsEditForm.value.liveName
    || props.liveName
    || authDisplayName.value
    || loginUserInfo.value?.userName
    || loginUserInfo.value?.userId
    || '',
  coverUrl: liveParamsEditForm.value.coverUrl || '',
  seatMode: props.seatMode || TUISeatMode.kApplyToTake,
}));

const endLiveDialogMessage = computed(() => {
  if (currentBattleInfo.value?.battleId) {
    return t('You are currently live streaming and in a PK battle. Are you sure you want to exit?');
  }
  if (coHostStatus.value === CoHostStatus.Connected) {
    return t('Currently connected, do you need to "exit connection" or "end live broadcast"');
  }
  if (coGuestConnected.value.length > 1) {
    return t('You are currently co-guesting with other streamers. Would you like to [End Live] ?');
  }
  return t('You are currently live streaming. Do you want to end it?');
});

const handleLeaveLive = async () => {
  if (isInLive.value) {
    await showEndLiveDialog();
  } else {
    emit('leaveLive');
  }
};

const handleLiveSettingConfirm = async (form: { liveName: string; coverUrl?: string }) => {
  const updatedForm = {
    liveName: form.liveName.trim(),
    coverUrl: (form.coverUrl || '').trim(),
  };
  if (isSvgCoverUrl(updatedForm.coverUrl)) {
    TUIToast.error({
      message: t('Unsupported image format'),
    });
    return;
  }

  if (!isInLive.value || !currentLive.value?.liveId) {
    liveParamsEditForm.value = updatedForm;
    return;
  }

  try {
    loading.value = true;
    const liveListManager = roomEngine.instance?.getLiveListManager() as {
      setLiveInfo: (params: { roomId: string; name?: string; coverUrl?: string }) => Promise<void>;
    } | undefined;
    if (!liveListManager) {
      throw new Error('live list manager is unavailable');
    }
    await liveListManager.setLiveInfo({
      roomId: currentLive.value.liveId,
      name: updatedForm.liveName,
      coverUrl: updatedForm.coverUrl,
    });
    if (currentLive.value) {
      currentLive.value.liveName = updatedForm.liveName;
      currentLive.value.coverUrl = updatedForm.coverUrl;
    }
    liveParamsEditForm.value = updatedForm;
  } catch (error: any) {
    const errorInfo = errorHandler.parseError(error);
    UIKitModal.openModal({
      id: errorInfo.code,
      title: t('Failed to update live settings'),
      content: t(errorInfo.message),
      type: 'error',
    });
    throw error;
  } finally {
    loading.value = false;
  }
};

const handleCopyLiveID = async () => {
  const liveId = currentLive.value?.liveId || liveParams.value.liveId;
  if (!liveId) {
    TUIToast.error({
      message: t('Copy failed'),
    });
    return;
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}#/live-player?liveId=${encodeURIComponent(liveId)}`;

  try {
    await copyToClipboard(shareUrl);
    TUIToast.success({
      message: t('Copy successful'),
    });
  } catch (error) {
    TUIToast.error({
      message: t('Copy failed'),
    });
  }
};

// Mobile camera handling. Two phases, both bypassing the video mixer —
// TRTC's VideoMixer plugin hard-throws ENV_NOT_SUPPORTED on mobile
// browsers, so the desktop StreamMixer pipeline can never work on a
// phone. We use the plain device path instead (the same one mobile
// co-hosts/co-guests publish through):
//
//  1. Pre-live preview (mount): startCameraTest into our own overlay
//     div — the device-test API works before joining any room, so the
//     broadcaster sees themselves as soon as the screen opens.
//  2. Publish (Start live, after joinLive): stop the test, then
//     openLocalCamera() so the feed is actually published in-room.
//
// Both phases set portrait resolution mode first: the default capture
// is landscape, and rendering a landscape frame cover-fit into a
// vertical phone screen produces the massive crop/zoom the user saw.
const MOBILE_PREVIEW_VIEW_ID = 'mobile-camera-preview-video';
let previewStream: MediaStream | null = null;
const isFrontCameraActive = ref(true);
const isCameraOff = ref(false);

// --- Basic camera filters + mirror (CSS-based) ---------------------------
// A lightweight "beauty"/filter picker. NOTE: these are applied as a CSS
// `filter` on the host's own <video> elements, so the host sees them on
// their screen and preview. They do NOT alter the published stream (that
// would need Tencent's paid beauty plugin, which isn't installed), so
// viewers still receive the raw camera — this is a local look only.
const CAMERA_FILTERS = [
  { name: 'Normal', value: 'none' },
  { name: 'Suave', value: 'brightness(1.08) contrast(0.95) saturate(1.06) blur(0.4px)' },
  { name: 'Cálido', value: 'brightness(1.05) saturate(1.28) sepia(0.15)' },
  { name: 'Frío', value: 'brightness(1.04) saturate(1.12) hue-rotate(-12deg)' },
  { name: 'Vívido', value: 'saturate(1.45) contrast(1.12)' },
  { name: 'B&N', value: 'grayscale(1) contrast(1.06)' },
  { name: 'Vintage', value: 'sepia(0.4) contrast(1.1) brightness(1.05)' },
];
const camFilter = ref('none');
const isMirrored = ref(false);
const filterPickerVisible = ref(false);

// Tango-style pre-live screen: share sheet, refs to trigger the existing
// settings/cover dialogs from the new floating icon stack, and the custom
// message sent to followers in the "you're live" push notification.
const preLiveShareOpen = ref(false);
const settingButtonRef = ref<{ open?: () => void } | null>(null);
const liveSettingButtonRef = ref<{ open?: () => void } | null>(null);
const liveStartMessage = ref('');

// Tapping the pre-live cover thumbnail opens the gallery directly (no
// intermediate dialog) — whatever photo is picked becomes the Cover
// shown once the live actually starts.
const preLiveCoverInputRef = ref<HTMLInputElement | null>(null);
const preLiveCoverUploading = ref(false);
async function onPreLiveCoverSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || preLiveCoverUploading.value) {
    return;
  }
  if (!UPLOAD_ALLOWED_MIME_TYPES.includes(file.type)) {
    TUIToast.error({ message: t('Unsupported image format') });
    return;
  }
  if (file.size > UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024) {
    TUIToast.error({ message: t('File size cannot exceed {size}MB').replace('{size}', String(UPLOAD_MAX_FILE_SIZE_MB)) });
    return;
  }
  if (!authUser.value?.id) {
    TUIToast.error({ message: t('Please log in first') });
    return;
  }
  preLiveCoverUploading.value = true;
  try {
    const url = await uploadCover(authUser.value.id, file);
    await handleLiveSettingConfirm({ liveName: liveParams.value.liveName, coverUrl: url });
  } catch (error) {
    TUIToast.error({ message: (error as Error)?.message || t('Upload failed, please try again') });
  } finally {
    preLiveCoverUploading.value = false;
  }
}
const camVideoStyle = computed(() => ({
  filter: camFilter.value,
  transform: isMirrored.value ? 'scaleX(-1)' : 'none',
}));
function selectFilter(value: string) {
  camFilter.value = value;
}

// Capture size candidates, best first. 1080x1920 is the native
// vertical-video mode on most phones (full field of view); browsers
// asked for a size the sensor doesn't natively have may satisfy it by
// CROPPING the frame — which is exactly the "demasiado cerca" zoom.
// NO aspectRatio constraint on purpose. Asking for a 9/16 aspect made
// the browser fabricate a portrait frame by CENTER-CROPPING the
// landscape sensor — that crop was the extreme zoom-in. Instead we ask
// for the sensor's full field of view (resizeMode 'none' = don't
// crop/scale to satisfy other constraints) and let object-fit: cover
// on the <video> fill the 9:16 screen, cropping only the sides. That
// shows the whole vertical framing zoomed out, no bars.
const PREVIEW_SIZE_CANDIDATES: MediaTrackConstraints[] = [
  { resizeMode: 'none' } as MediaTrackConstraints,
  { width: { ideal: 1280 }, height: { ideal: 720 } },
  {},
];

const acquirePreviewStream = async (): Promise<MediaStream> => {
  let lastError: unknown;
  for (const size of PREVIEW_SIZE_CANDIDATES) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: isFrontCameraActive.value ? 'user' : 'environment',
          ...size,
        },
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

// Decide how to fit the delivered frame instead of assuming: a tall
// (portrait) frame can cover-fill the screen with a negligible crop;
// anything squarer/landscape gets contain so it can never zoom in.
const applyPreviewFit = (videoEl: HTMLVideoElement) => {
  // Full-bleed, no black bars (the Instagram/TikTok look). If the
  // camera honored the portrait request the crop is negligible; if it
  // only gave landscape, cover shows the centered vertical slice —
  // still better received than letterbox bars.
  videoEl.style.objectFit = 'cover';
  // Mirror is controlled solely by the manual mirror button through the
  // camVideoStyle binding on this <video>, so we don't set transform here
  // (doing so fought that binding and made the preview flip on go-live).
};

// The host's own (local) self-view is attached via setLocalVideoView,
// which — unlike the remote path — sets NO render params, so it
// inherits a Fill (cover) default that crop-zooms a landscape capture
// into the portrait seat tile. That's why co-hosts (remote, explicitly
// rendered) looked complete but the host looked cropped. Force the
// local render to Fit (contain): the whole frame is shown, never
// cropped. Mirror only the front camera.
const applyLocalRenderFit = async () => {
  try {
    const trtcCloud = (roomEngine.instance as any)?.getTRTCCloud?.();
    await trtcCloud?.setLocalRenderParams({
      rotation: TRTCVideoRotation.TRTCVideoRotation0,
      // Fill = full-bleed cover, consistent with the preview. Fit
      // (contain) produced black bars, which the user rejected.
      fillMode: TRTCVideoFillMode.TRTCVideoFillMode_Fill,
      // Mirror is driven ONLY by the manual mirror button (isMirrored,
      // default OFF) so going live never auto-flips the view — it stays
      // exactly like the pre-live preview. Toggling the button re-applies
      // this (see the watch below).
      mirrorType: isMirrored.value
        ? TRTCVideoMirrorType.TRTCVideoMirrorType_Enable
        : TRTCVideoMirrorType.TRTCVideoMirrorType_Disable,
    });
  } catch (error) {
    console.warn('[LivePusherView] setLocalRenderParams failed:', error);
  }
};

// Keep the live render in sync when the host toggles the mirror button
// mid-stream (the pre-live preview already reacts via camVideoStyle).
watch(isMirrored, () => {
  if (isInLive.value) {
    void applyLocalRenderFit();
  }
});

// Force the PUBLISHED stream into a 9:16 portrait profile so the audience
// sees the same framing the host does (fixes the "viewers see me zoomed in"
// crop). Set directly on the TRTC cloud instance — the higher-level
// updateVideoQuality/setVideoResolutionMode helpers cropped even harder.
const applyPortraitEncoder = async () => {
  try {
    const trtcCloud = (roomEngine.instance as any)?.getTRTCCloud?.();
    if (!trtcCloud) {
      return;
    }
    const param = new TRTCVideoEncParam(
      TRTCVideoResolution.TRTCVideoResolution_1280_720,
      TRTCVideoResolutionMode.TRTCVideoResolutionModePortrait,
      24,
      1500,
    );
    await trtcCloud.setVideoEncoderParam(param);
  } catch (error) {
    console.warn('[LivePusherView] setVideoEncoderParam failed:', error);
  }
};

// Own getUserMedia preview with explicit PORTRAIT constraints — the
// SDK's startCameraTest takes no constraints and always captures
// landscape, which can never fill a vertical phone screen.
const startMobileCameraPreview = async () => {
  // Runs both pre-live AND during a solo live: our own getUserMedia
  // capture (correctly framed, see acquirePreviewStream) stays as the
  // host's self-view over TRTC's own — which reverts to the cropped
  // render once live starts. Skipped only while camera-off or during a
  // co-host/battle (TRTC's tiles show everyone then).
  if (!isMobile || previewStream || isCameraOff.value || hasOthersOnScreen.value) {
    return;
  }
  try {
    previewStream = await acquirePreviewStream();
    const videoEl = document.getElementById(MOBILE_PREVIEW_VIEW_ID) as HTMLVideoElement | null;
    if (videoEl) {
      videoEl.srcObject = previewStream;
      videoEl.onloadedmetadata = () => applyPreviewFit(videoEl);
      await videoEl.play().catch(() => { /* autoplay quirks are fine, muted */ });
      applyPreviewFit(videoEl);
    }
  } catch (error) {
    // Silent: this is only the preview; the decisive (toasting)
    // attempt happens on Start live.
    console.error('[LivePusherView] camera preview failed:', error);
  }
};

const stopMobileCameraPreview = async () => {
  if (!previewStream) {
    return;
  }
  previewStream.getTracks().forEach(track => track.stop());
  previewStream = null;
  const videoEl = document.getElementById(MOBILE_PREVIEW_VIEW_ID) as HTMLVideoElement | null;
  if (videoEl) {
    videoEl.srcObject = null;
  }
};

// Mobile browsers can suspend/mute the camera track while the tab is
// backgrounded (switching apps, locking the phone). The <video> keeps
// painting its last frame forever on return — startMobileCameraPreview()
// is normally a no-op once previewStream is set, so nothing ever
// reacquired it. On resume, check the track is actually still live and,
// if not, tear down and restart the preview.
const isPreviewStreamHealthy = () => {
  const track = previewStream?.getVideoTracks?.()[0];
  return !!track && track.readyState === 'live' && !track.muted;
};

const refreshCameraAfterResume = async () => {
  if (!isMobile || isCameraOff.value || hasOthersOnScreen.value || isPreviewStreamHealthy()) {
    return;
  }
  await stopMobileCameraPreview();
  await startMobileCameraPreview();
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    void refreshCameraAfterResume();
  }
};

// Front/rear camera toggle — pre-live restarts our preview stream with
// the other facing mode; in-live delegates to the engine's switch.
const toggleMobileCameraFacing = async () => {
  if (!isMobile || isCameraOff.value) {
    return;
  }
  isFrontCameraActive.value = !isFrontCameraActive.value;
  try {
    if (isInLive.value) {
      await switchCamera({ isFrontCamera: isFrontCameraActive.value });
      // switchCamera reopens the device on the engine's side, which resets
      // the encoder back to its default (cropped/landscape) profile — the
      // exact "camera zooms in" the viewer/host saw right after flipping
      // cameras during a battle. Re-apply our 9:16 portrait profile (and
      // do it again on a delay in case a slow device echoes the reset).
      await applyPortraitEncoder();
      await applyLocalRenderFit();
      setTimeout(() => { void applyPortraitEncoder(); void applyLocalRenderFit(); }, 800);
    } else {
      await stopMobileCameraPreview();
      await startMobileCameraPreview();
    }
  } catch (error) {
    console.error('[LivePusherView] camera switch failed:', error);
  }
};

// Camera on/off toggle — pre-live stops/starts the preview stream;
// in-live closes/re-publishes the local camera.
const toggleMobileCameraOff = async () => {
  if (!isMobile) {
    return;
  }
  isCameraOff.value = !isCameraOff.value;
  try {
    if (isInLive.value) {
      if (isCameraOff.value) {
        await closeLocalCamera();
      } else {
        await publishMobileCamera();
      }
    } else if (isCameraOff.value) {
      await stopMobileCameraPreview();
    } else {
      await startMobileCameraPreview();
    }
  } catch (error) {
    console.error('[LivePusherView] camera toggle failed:', error);
  }
};

// Deduped as a shared promise so concurrent callers await the
// in-flight attempt instead of double-starting.
let publishCameraPromise: Promise<void> | null = null;
const publishMobileCamera = (): Promise<void> => {
  if (!isMobile || isCameraOff.value) {
    return Promise.resolve();
  }
  if (publishCameraPromise) {
    return publishCameraPromise;
  }
  publishCameraPromise = (async () => {
    try {
      // NOTE: we intentionally keep our own getUserMedia preview
      // running as the host's self-view during a solo live (it's
      // correctly framed; TRTC's local render is not). TRTC opens its
      // own capture below for the published stream — Android Chrome
      // allows both to read the front camera concurrently.
      // Publish EXACTLY like Tencent's stock co-guest flow does
      // (useSeatApplication.ts): a bare openLocalCamera(), nothing
      // else. Comparing the two live: the co-guest feed (stock path)
      // rendered complete while the host feed — which additionally
      // applied setVideoResolutionMode/updateVideoQuality/switchCamera
      // — came out massively cropped. Those "portrait profile" calls
      // were the problem, not the fix.
      // The engine finishes its own async init after engine-ready;
      // retry with backoff instead of giving up on the first race.
      let lastError: unknown;
      for (const delayMs of [0, 800, 2000, 4000]) {
        if (delayMs) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        try {
          await openLocalCamera();
          if (!isFrontCameraActive.value) {
            // Only touch switchCamera when the user chose the rear
            // camera; the default is already the front one.
            try {
              await switchCamera({ isFrontCamera: false });
            } catch (switchError) {
              console.warn('[LivePusherView] switch to rear camera failed:', switchError);
            }
          }
          // Publish in a PORTRAIT 9:16 profile (720x1280) so viewers get
          // the same vertical framing the host sees. TRTC's default encoder
          // profile is a squarer/landscape size that gets cropped hard into
          // the viewer's portrait player — that crop was the "zoom" the
          // audience saw. A 9:16 output matches the phone screen, so there's
          // nothing left to crop.
          await applyPortraitEncoder();
          // Fix the local self-view fit (see applyLocalRenderFit).
          // Twice — the seat player re-attaches the local view via
          // setLocalVideoView shortly after publishing, which can land
          // after our first call.
          await applyLocalRenderFit();
          setTimeout(() => { void applyPortraitEncoder(); applyLocalRenderFit(); }, 1500);
          return;
        } catch (error) {
          lastError = error;
          console.error('[LivePusherView] camera publish attempt failed, retrying:', error);
        }
      }
      throw lastError;
    } catch (error) {
      console.error('[LivePusherView] Failed to publish camera:', error);
      // Include the underlying reason so on-device failures are
      // diagnosable from the toast alone (the console isn't reachable
      // on a phone).
      const reason = (error as Error)?.message || String(error);
      TUIToast.error({
        message: `${t('Please check the current browser camera permission')} (${reason})`,
      });
    } finally {
      publishCameraPromise = null;
    }
  })();
  return publishCameraPromise;
};

const handleStartLive = async () => {
  try {
    if (loading.value) {
      return;
    }
    if (!loginUserInfo.value?.userId) {
      TUIToast.info({
        message: t('Please login first'),
      });
      return;
    }
    loading.value = true;
    await initRoomEngineLanguage();
    await startLive({
      liveId: liveParams.value.liveId,
      liveName: liveParams.value.liveName,
      coverUrl: liveParams.value.coverUrl,
      // Enable the gift + likes kit for this room so viewers see the
      // LiveGift panel and like button (both already wired into the
      // player views; the gift catalog itself comes from Tencent's
      // server for this SDKAppID).
      isGiftEnabled: true,
      isLikeEnabled: true,
      // On mobile, default to the dynamic grid template so that when a
      // second person joins (co-host / PK battle), the two video feeds
      // stack full-width on top of each other instead of using the
      // desktop-oriented side-by-side layout. Users can still change
      // this from "Layout Settings" before starting a battle.
      ...(isMobile ? { seatLayoutTemplateId: TUISeatLayoutTemplate.PortraitDynamic_Grid9 } : {}),
    });
    await joinLive({
      liveId: liveParams.value.liveId,
    });
    loading.value = false;
    openLocalMicrophone();
    // Re-open the camera now that we're inside the room so the local
    // feed is actually published to viewers (the pre-live preview
    // started before joining doesn't guarantee in-room publishing).
    publishMobileCamera();
    // Notify followers (native push) that this creator just went live.
    if (authUser.value) {
      void notifyLiveStarted(authUser.value.id, {
        name: authDisplayName.value,
        avatar: (authUser.value.user_metadata?.avatar_url as string) || null,
        liveId: liveParams.value.liveId,
        message: liveStartMessage.value.trim(),
      });
    }
  } catch (error: any) {
    loading.value = false;
    if (typeof error.message === 'string'
      && error.message.indexOf('this room already exists, and you are the owner') !== -1) {
      await joinLive({
        liveId: liveParams.value.liveId,
      });
      await openLocalMicrophone();
      publishMobileCamera();
      return;
    }
    const errorInfo = errorHandler.parseError(error);
    UIKitModal.openModal({
      id: errorInfo.code,
      title: t('Failed to create live'),
      content: t(errorInfo.message),
      type: 'error',
    });
    throw error;
  }
};
// End-of-live summary (our own — Tencent's web kit just closes the room
// with no recap). Captured BEFORE endLive() resets the counters.
const endSummary = ref<{ duration: string; coins: number; viewers: number } | null>(null);

const handleEndLive = async () => {
  try {
    loading.value = true;
    exitLiveDialogVisible.value = false;
    const summary = {
      duration: liveElapsedText.value,
      coins: diamondsReceived.value,
      viewers: audienceCount.value || 0,
    };
    const durationSeconds = liveElapsed.value;
    await endLive();
    endSummary.value = summary;
    // Persist the session for the Estadísticas screen (hours, coins,
    // streaks) — best-effort.
    void recordLiveSession(durationSeconds, summary.coins, summary.viewers);
    loading.value = false;
  } catch (error: any) {
    const errorInfo = errorHandler.parseError(error);
    UIKitModal.openModal({
      id: errorInfo.code,
      title: t('Failed to end live'),
      content: t(errorInfo.message),
      type: 'error',
    });
    loading.value = false;
    exitLiveDialogVisible.value = false;
    throw error;
  }
};
const handleExitConnection = async () => {
  if (coHostStatus.value === CoHostStatus.Disconnected) {
    exitLiveDialogVisible.value = false;
    return;
  }
  exitLiveDialogVisible.value = false;
  try {
    await exitHostConnection();
  } catch (error) {
    console.error('[LivePusherView] exitHostConnection from end-live dialog failed', error);
  }
};
// Leave just the PK/battle (score + timer), keeping the live broadcast
// going — previously the only option shown here during an active battle
// was "End live" (ending the whole broadcast), with no way to step out
// of the battle alone and later send a new PK invite via the CoHost/PK
// button.
const handleExitBattle = async () => {
  const battleId = currentBattleInfo.value?.battleId;
  exitLiveDialogVisible.value = false;
  if (!battleId) {
    return;
  }
  try {
    await exitBattle({ battleId });
  } catch (error) {
    console.error('[LivePusherView] exitBattle failed:', error);
    TUIToast.error({ message: 'No se pudo salir de la batalla.' });
  }
};
const showEndLiveDialog = async () => {
  if (loading.value) {
    return;
  }
  exitLiveDialogVisible.value = true;
};

const handleLiveEnded = (eventInfo: LiveListEventInfo) => {
  if (eventInfo.reason === LiveEndedReason.endedByHost) {
    return;
  }
  if (eventInfo.reason === LiveEndedReason.endedByServer) {
    TUIToast.warning({
      message: t('Stream closed due to content violation'),
      duration: 5000,
    });
    return;
  }
  // Fallback for unknown ending reasons
  TUIToast.warning({
    message: t('The live room has been closed'),
    duration: 5000,
  });
};

const handleCustomMessageReceived = (barrage: Barrage) => {
  if (barrage.businessId === 'violation_alert') {
    TUIToast.warning({
      message: t('The current display or content may pose a violation risk. Please be aware of the platform regulations'),
      duration: 3000,
    });
  }  
};

onMounted(async () => {
  subscribeLiveListEvent(LiveListEvent.onLiveEnded, handleLiveEnded);
  subscribeBarrageEvent(BarrageEvent.onCustomMessageReceived, handleCustomMessageReceived)
  // Guard the pusher entry against browsers that cannot push video.
  // We intentionally subscribe to the live-end event first so an
  // allowed user never misses an event during the (cached) probe.
  // When unsupported, the guard already showed a toast; we leave
  // via the existing channel and the global toast portal keeps the
  // message visible across the navigation. Only flip
  // `rtcSupportChecked` on the success path so the pusher subtree
  // is never mounted on unsupported browsers.
  const allowed = await guardLiveEntry('pusher');
  if (!allowed) {
    emit('leaveLive');
    return;
  }
  rtcSupportChecked.value = true;
  // Pre-live camera preview. Wait for the DOM update AND for
  // TUIRoomEngine's own WASM engine to report ready first — a plain
  // nextTick() (DOM-only) isn't enough, the engine's async init can
  // still be in flight. Silent: this is just the preview attempt; the
  // decisive (toasting) attempt runs after joining the room in
  // handleStartLive.
  await nextTick();
  TUIRoomEngine.once('ready', () => {
    startMobileCameraPreview();
  });
  // Defensive fallback in case the 'ready' event above never fires for
  // this listener (e.g. some edge case in event timing) — the preview
  // starter is a no-op once running, so this is safe to also run.
  autoStartCameraFallbackTimer = window.setTimeout(() => {
    startMobileCameraPreview();
  }, 2000);
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  if (autoStartCameraFallbackTimer !== null) {
    window.clearTimeout(autoStartCameraFallbackTimer);
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  stopMobileCameraPreview();
  unsubscribeLiveListEvent(LiveListEvent.onLiveEnded, handleLiveEnded);
  unsubscribeBarrageEvent(BarrageEvent.onCustomMessageReceived, handleCustomMessageReceived);
  updateLiveInfo({ layoutTemplate: 0 });
});
</script>

<style lang="scss" scoped>
@import './style/index.scss';

// iOS 26 "liquid glass" treatment for the floating circular buttons on
// the mobile broadcast screen (back arrow, camera flip/off, add-source).
@mixin liquid-glass {
  background: rgba(255, 255, 255, 0.12) !important;
  -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
  backdrop-filter: blur(16px) saturate(180%) !important;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.35),
    inset 0 -1px 1px rgba(255, 255, 255, 0.1),
    0 6px 16px rgba(0, 0, 0, 0.3) !important;
}

.live-pusher-main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  gap: 6px;
  border-radius: 8px;
  @include scrollbar;

  .main-left {
    width: 20%;
    max-width: 320px;
    height: 100%;
    color: $text-color1;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .main-left-top {
      flex: 1;
      background-color: var(--bg-color-operate);
      padding: 16px;
      .main-left-top-title {
        display: flex;
        align-items: center;
        color: $text-color1;
        height: 40px;
        box-sizing: border-box;
        margin-bottom: 16px;

        .title-text {
          @include text-size-16;
          display: inline-flex;
          align-items: center;
          justify-content: start;

          .icon-back {
            &:hover {
              cursor: pointer;
            }
          }
        }
      }
    }
    .main-left-bottom {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background-color: var(--bg-color-operate);
      padding: 16px;

      .main-left-bottom-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        .main-left-bottom-fold {
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          color: $text-color2;
          @include text-size-12;
        }
      }

      .main-left-bottom-title {
        @include text-size-16;
      }

      .main-left-bottom-tools {
        @include dividing-line('top');
        margin-top: 16px;
        display: flex;
      }
    }
  }
  .main-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    .main-center-top {
      box-sizing: border-box;
      padding: 0 16px;
      width: 100%;
      height: 56px;
      background-color: var(--bg-color-operate);
      color: $text-color1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;

      .main-center-top-left {
        @include text-size-16;
        display: flex;
        align-items: center;
        gap: 8px;

        .copy-icon {
          cursor: pointer;

          &:hover {
            color: $icon-hover-color;
          }
        }
      }

      .main-center-top-right {
        @include text-size-12;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .top-end-live {
        border: none;
        border-radius: 999px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 800;
        color: #fff;
        background: linear-gradient(135deg, #ff2e74, #ff5a3c);
        box-shadow: 0 3px 12px rgba(255, 46, 116, 0.4);
        cursor: pointer;
        white-space: nowrap;
      }
      .top-end-live:disabled {
        opacity: 0.6;
      }

      &::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 16px;
        right: 16px;
        height: 1px;
        background-color: var(--stroke-color-primary);
      }
    }
    .main-center-center {
      flex: 1;
      min-width: 0;
      min-height: 0;
      color: #131417;
    }
    .main-center-bottom {
      width: 100%;
      background-color: var(--bg-color-operate);
      display: flex;
      justify-content: space-between;
      padding: 0 16px;
      box-sizing: border-box;
      flex-direction: column;
      position: relative;

      &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 16px;
        right: 16px;
        height: 1px;
        background-color: var(--stroke-color-primary);
      }

      .main-center-bottom-header {
        @include text-size-14;
      }
      .main-center-bottom-content {
        display: flex;
        justify-content: space-between;
        height: 72px;

        .main-center-bottom-left {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 16px;
          .main-center-bottom-tools {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }
        }
        .main-center-bottom-right {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
    }
  }
  .main-right {
    height: 100%;
    width: 20%;
    max-width: 320px;
    color: $text-color1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 200px;

    .main-right-top {
      background-color: var(--bg-color-operate);
      color: $text-color1;
      height: 30%;
      padding: 16px;

      .main-right-top-title {
        display: flex;
        align-items: center;
        color: $text-color1;
        height: 40px;
        box-sizing: border-box;

        .title-text {
          @include text-size-16;
        }

        .title-count {
          font-weight: 400;
          color: $text-color2;
        }
      }
    }
    .main-right-bottom {
      flex: 1;
      background-color: var(--bg-color-operate);
      color: $text-color1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 16px;

      .main-right-bottom-header {
        display: flex;
        flex-direction: column;
      }

      .message-list-container {
        flex: 1 1 auto;
        user-select: text;
      }
    }
  }
}

.arrow-icon {
  box-sizing: border-box;
  display: inline-block;
  @include icon-size-12;
  transition: transform 0.2s ease-in-out;
  background-color: transparent;
  color: $text-color2;

  &.expanded {
    transform: rotate(0deg);
  }
  &.collapsed {
    transform: rotate(180deg);
  }
}

.loading-icon {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.card-title {
  @include text-size-16;
  @include dividing-line;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

// Mobile layout — Bigo-style full-screen broadcast.
//
// The desktop layout is a fixed 3-column studio (source panel | video |
// viewers+chat) that makes no sense on a phone. On mobile we turn the
// video preview into a full-screen background and overlay only the
// essentials on top of it: a translucent top bar (title + viewer count)
// and a bottom control bar with a large "Start live" button. The camera
// auto-starts (see startMobileCameraPreview / publishMobileCamera) so the manual source picker is
// desktop-only, and the viewers list and side chat panel are hidden to
// keep the broadcast screen clean, just like Bigo.
//
// Gated on the .is-mobile class (user-agent based, set in the template)
// instead of a width media query: a phone held in landscape exceeds any
// sane width breakpoint and was falling back to the desktop layout.
//
// NOTE: every override below carries !important. Without it, several
// rules here silently lost to the desktop rules of equal selector
// specificity after this component's SCSS went through the production
// build (Vite/PostCSS chunked several components' scoped styles
// together and the cascade order that came out was not the source
// order) — verified by rendering the actual compiled CSS in a headless
// browser and inspecting computed styles. !important sidesteps that
// build-order dependency entirely.
.live-pusher-main.is-mobile {
  position: relative !important;
  display: block !important;
  height: 100% !important;
  gap: 0 !important;
  overflow: hidden !important;
  background-color: #000 !important;

  // Video preview = full-screen base layer.
  .main-center {
    position: absolute !important;
    inset: 0 !important;
    flex: none !important;
    display: flex !important;
    flex-direction: column !important;

    .main-center-center {
      position: absolute !important;
      inset: 0 !important;
      z-index: 1 !important;
      min-height: 0 !important;

      // StreamMixer/LiveCoreView (solo broadcast AND battle/co-host
      // split view alike) measures #live-core-view-container with a
      // ResizeObserver and fits its aspect-ratio-correct canvas inside
      // whatever size that container reports. Without an explicit
      // 100%/100% here, the container only takes its content's
      // intrinsic size, the ResizeObserver reports something small,
      // and the video renders in a tiny box instead of filling the
      // screen — this is what actually makes it full-size (matching
      // the container's height lets the aspect-ratio math use all the
      // available space instead of shrinking to fit content).
      :deep(#live-core-view-container),
      :deep(.live-core-view-container) {
        width: 100% !important;
        height: 100% !important;
      }

      // Pre-live camera preview overlay (startCameraTest target) —
      // sits above LiveCoreView's "No video" placeholder until the
      // published feed takes over on Start live.
      .mobile-camera-preview {
        position: absolute !important;
        inset: 0 !important;
        z-index: 2 !important;
        background: #000;

        video {
          width: 100% !important;
          height: 100% !important;
          // object-fit + mirror are set from JS (applyPreviewFit)
          // based on the aspect the camera actually delivered — tall
          // frames cover-fill (Instagram look), anything else contains
          // so it can never crop-zoom. No !important here on purpose:
          // the inline style must win.
          object-fit: contain;
        }
      }

      // Same guarantee for the in-live self view rendered by
      // LiveCoreView: never crop the local frame, whatever its aspect.
      // Also apply the host's chosen basic filter (local look only —
      // the published stream is unaffected).
      :deep(#atomicx-live-stream-content) video,
      :deep(#atomicx-live-stream-content) canvas {
        object-fit: contain !important;
        filter: var(--cam-filter, none);
      }
    }

    // Floating camera controls (flip / mirror / filters / on-off),
    // stacked under the top bar on the right, above every video layer.
    .mobile-camera-actions {
      position: absolute !important;
      top: 60px !important;
      right: 12px !important;
      z-index: 4 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 10px !important;
      pointer-events: auto !important;

      .camera-action-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        cursor: pointer;
        @include liquid-glass;

        &.is-on {
          background: rgba(55, 120, 255, 0.7) !important;
        }
        &.is-off {
          background: rgba(220, 53, 69, 0.65) !important;
        }
      }

      // Pre-live: sits below the new Tango-style action stack instead of
      // under the top bar, so the two don't overlap.
      &.shifted-down {
        top: 166px !important;
      }
    }

    // Tango-style pre-live stack (effects / share / settings), transparent
    // circular buttons with just an icon — no card, no labels.
    .pre-live-actions {
      position: absolute !important;
      top: 12px !important;
      right: 12px !important;
      z-index: 4 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 14px !important;
      pointer-events: auto !important;

      .pre-live-action-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        cursor: pointer;
        filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.5));

        &.is-on svg {
          filter: drop-shadow(0 0 4px rgba(255, 200, 87, 0.9));
        }
      }
    }

    // Live stats overlay (time on air + diamonds), pinned top-left just
    // under the title bar.
    .live-stats {
      position: absolute !important;
      top: 58px !important;
      left: 12px !important;
      z-index: 4 !important;
      display: flex;
      gap: 8px;
      pointer-events: none;

      .live-stat {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 26px;
        padding: 0 10px;
        border-radius: 13px;
        font-size: 12.5px;
        font-weight: 700;
        color: #fff;
        background: rgba(0, 0, 0, 0.45);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
      }
      .live-stat-diamonds {
        background: linear-gradient(90deg, rgba(255, 61, 129, 0.75), rgba(155, 45, 247, 0.65));
      }
    }

    // Horizontal filter picker, pinned just above the bottom controls.
    .filter-picker {
      position: absolute !important;
      left: 0;
      right: 0;
      bottom: 130px;
      z-index: 4 !important;
      display: flex;
      gap: 8px;
      padding: 0 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      pointer-events: auto !important;

      &::-webkit-scrollbar { display: none; }

      .filter-chip {
        flex: 0 0 auto;
        height: 34px;
        padding: 0 16px;
        border-radius: 17px;
        border: 1px solid rgba(255, 255, 255, 0.25);
        background: rgba(0, 0, 0, 0.4);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;

        &.active {
          background: rgba(55, 120, 255, 0.85);
          border-color: transparent;
        }
      }
    }

    // Title + viewer count → translucent overlay pinned to the top,
    // shifted right so it doesn't collide with the back arrow (now
    // floating top-left, see .main-left below).
    .main-center-top {
      position: relative !important;
      z-index: 3 !important;
      height: 52px !important;
      padding-left: 56px !important;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0)) !important;
      &::after {
        display: none !important;
      }
    }

    // Controls + Start live → translucent overlay pinned to the bottom.
    .main-center-bottom {
      position: relative !important;
      z-index: 3 !important;
      margin-top: auto !important;
      background: linear-gradient(0deg, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0)) !important;
      &::before {
        display: none !important;
      }

      // Tango-style pre-live card: cover thumbnail (editable) + the
      // follower notification message, above the tools/start row.
      .pre-live-card {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 0 16px 12px !important;

        .pre-live-cover {
          position: relative;
          flex-shrink: 0;
          width: 88px;
          height: 116px;
          border-radius: 14px;
          overflow: hidden;
          border: none;
          padding: 0;
          cursor: pointer;
          background: linear-gradient(160deg, #3a3a44, #1c1c22);

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .pre-live-cover-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 34px;
          }
          .pre-live-cover-edit {
            position: absolute;
            right: 5px;
            bottom: 5px;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.55);
          }
        }

        .pre-live-notify {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .pre-live-notify-label {
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.7);
        }
        .pre-live-notify-input {
          width: 100%;
          height: 38px;
          padding: 0 14px;
          border-radius: 19px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          font-size: 13.5px;
          outline: none;

          &::placeholder {
            color: rgba(255, 255, 255, 0.45);
          }
        }
      }

      .main-center-bottom-content {
        height: auto !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 12px !important;
        padding: 12px 0 20px !important;

        .main-center-bottom-left {
          width: 100% !important;
          justify-content: center !important;
          flex-wrap: wrap !important;
          gap: 12px !important;

          // All the live controls (mic, speaker, co-guest, co-host,
          // orientation, modos, setting) in ONE evenly-spaced, centered
          // row that wraps cleanly instead of a couple of buttons floating
          // loose over the video.
          .main-center-bottom-tools {
            display: flex !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 6px 16px !important;
            width: 100% !important;
          }
        }

        .main-center-bottom-right {
          width: 100% !important;

          // Pink → purple gradient pill, matching the brand gradient used
          // across the app (login screen, gift banners). This block only
          // ever renders the "Iniciar directo" button on mobile — once
          // live, End live moves to the top pill instead.
          :deep(button) {
            width: 70% !important;
            max-width: 320px !important;
            height: 48px !important;
            margin: 0 auto !important;
            border-radius: 24px !important;
            font-size: 16px !important;
            background: linear-gradient(90deg, #ff3d70, #9b2df7) !important;
            border: none !important;
            color: #fff !important;
            font-weight: 700 !important;
          }
        }
      }
    }
  }

  // Source / "Add Camera" controls → no card, just small floating
  // circular icon buttons over the video (Tango/Bigo style), with the
  // back arrow pinned to the top-left corner on its own.
  .main-left {
    position: absolute !important;
    top: 12px !important;
    right: 12px !important;
    left: auto !important;
    z-index: 2 !important;
    width: auto !important;
    max-width: none !important;
    min-width: 0 !important;
    height: auto !important;
    gap: 0 !important;
    pointer-events: none !important;

    .main-left-top {
      flex: none !important;
      pointer-events: none !important;
      background: transparent !important;
      padding: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end !important;
      gap: 10px !important;

      .main-left-top-title {
        // Fixed relative to the viewport (not .main-left, which is
        // anchored top-right) so the back arrow can sit at the opposite
        // corner. LiveHeader is hidden on mobile (see live-pusher.vue),
        // so this screen now starts at the very top of the viewport —
        // just a small safe-area offset, not the header's height.
        position: fixed !important;
        top: 12px !important;
        left: 8px !important;
        height: auto !important;
        margin-bottom: 0 !important;
        pointer-events: auto !important;

        // Hide the "Video Source" label text but keep the back-arrow
        // icon at its normal size (it's an SVG sized via width/height,
        // not affected by font-size).
        .title-text {
          font-size: 0 !important;
        }

        .icon-back {
          display: inline-flex !important;
          padding: 10px !important;
          border-radius: 50% !important;
          @include liquid-glass;
        }
      }

      // The long "We support you to add rich sources" blurb is desktop
      // filler — hide it, keep only the icon buttons themselves.
      :deep(.live-scene-placeholder-content) {
        display: none !important;
      }

      :deep(.add-material-list) {
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        pointer-events: auto !important;
      }

      :deep(.add-material-item) {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 40px !important;
        height: 40px !important;
        border-radius: 50% !important;
        @include liquid-glass;

        // Icon-only: hide the text label under each icon.
        span {
          display: none !important;
        }
      }

      // Once a camera/source is added, this panel collapses on its own
      // into Tencent's compact "add more" button — keep it small too.
      :deep(.live-scene-button) {
        width: 40px !important;
        height: 40px !important;
        border-radius: 50% !important;
        pointer-events: auto !important;
        @include liquid-glass;
      }
    }

    // "Live tool" (CoGuest / CoHost) fold is not needed for a basic
    // solo broadcast — hide it on mobile.
    .main-left-bottom {
      display: none !important;
    }
  }

  // Viewers list + side barrage/chat panel → hidden for a clean screen.
  .main-right {
    display: none !important;
  }

  // Live chat overlay (our custom LiveChat with VIP silent messages).
  // Sits above the bottom controls; the component manages its own look
  // and re-enables pointer events on its list + input.
  .mobile-barrage {
    position: absolute !important;
    left: 10px !important;
    right: 10px !important;
    // Sits just above the single-row controls (End live moved to the top,
    // Portrait removed, so the bottom is now one tidy row — the chat can
    // drop lower without overlapping it).
    bottom: 150px !important;
    height: 34vh !important;
    z-index: 3 !important;
    pointer-events: none !important;
  }

  // Battle / co-host: the mixed canvas is 720x640 (two 9:16 halves), so
  // give the container the SAME aspect ratio pinned under the top bar —
  // the video then fills it completely edge to edge, and the viewer
  // messages take the space below.
  &.is-battle {
    .main-center-center {
      inset: 50px 0 auto 0 !important;
      height: auto !important;
      aspect-ratio: 9 / 8;

      // Both battle tiles must fill their half edge to edge — "contain"
      // (used for the solo self-view so the host's own frame is never
      // cropped) instead left visible navy letterbox bars around
      // whichever participant's camera aspect didn't exactly match the
      // tile. In battle mode a full, gap-free frame matters more than
      // avoiding a slight crop, so switch to "cover" here. More specific
      // than the base rule above (one extra class), so it wins.
      :deep(#atomicx-live-stream-content) video,
      :deep(#atomicx-live-stream-content) canvas {
        object-fit: cover !important;
      }
    }
    .mobile-barrage {
      top: calc(58px + 88.9vw) !important; // just under the tiles (100vw * 8/9)
      bottom: 150px !important;
      height: auto !important;
    }
  }
}

// Host mounts Tencent's <LiveGift> only for its teleported received-gift
// display; its own "send gift" button is hidden (the host doesn't gift
// their own live). The GiftCardPlayer teleports to #app so it's unaffected.
.host-gift-receiver {
  display: none;
}

// --- End-of-live summary ---------------------------------------------------
.end-summary-backdrop {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.7);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
.end-summary {
  width: 100%;
  max-width: 360px;
  padding: 26px 20px;
  border-radius: 24px;
  background: linear-gradient(160deg, rgba(36, 18, 61, 0.98), rgba(13, 7, 24, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  text-align: center;
}
.es-title {
  margin: 0 0 18px;
  font-size: 20px;
  font-weight: 800;
}
.es-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.es-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 14px 6px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.es-card-coins {
  background: linear-gradient(135deg, rgba(255, 61, 129, 0.28), rgba(155, 45, 247, 0.24));
  border-color: transparent;
}
.es-ico { font-size: 20px; }
.es-val { font-size: 17px; font-weight: 800; }
.es-lbl { font-size: 11px; color: rgba(255, 255, 255, 0.6); }
.es-note {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.75);
}
.es-close {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 23px;
  background: linear-gradient(135deg, #8b3dff, #ff2e74);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

// --- Swipe-left stats panel ------------------------------------------------
.stats-backdrop {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.25);
}
.stats-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 41;
  width: 80%;
  max-width: 340px;
  padding: 74px 18px 24px;
  box-sizing: border-box;
  background: linear-gradient(160deg, rgba(36, 18, 61, 0.96), rgba(13, 7, 24, 0.97));
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: -14px 0 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: #fff;
}
.stats-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 14px 6px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.stat-card-diamonds {
  background: linear-gradient(135deg, rgba(255, 61, 129, 0.28), rgba(155, 45, 247, 0.24));
  border-color: transparent;
}
.stat-ico { font-size: 20px; }
.stat-val { font-size: 17px; font-weight: 800; }
.stat-lbl { font-size: 11px; color: rgba(255, 255, 255, 0.6); }
.stats-encourage {
  display: flex;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(139, 61, 255, 0.22), rgba(255, 46, 116, 0.16));
  border: 1px solid rgba(199, 155, 255, 0.35);
}
.enc-emoji { font-size: 22px; flex: 0 0 auto; }
.stats-encourage p {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.4;
  color: #fff;
}
.stats-hint {
  margin: auto 0 0;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.stats-slide-enter-active,
.stats-slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s ease;
}
.stats-slide-enter-from,
.stats-slide-leave-to {
  transform: translateX(100%);
  opacity: 0.4;
}
</style>
