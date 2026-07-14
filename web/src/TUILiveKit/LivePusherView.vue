<template>
  <!--
    The is-mobile class (user-agent based, orientation-independent)
    gates the full-screen mobile styling — a width media query alone
    missed phones held in landscape, which fell back to the desktop
    3-column studio layout.
  -->
  <div id="live-pusher-view" class="live-pusher-main" :class="{ 'is-mobile': isMobile, 'is-battle': isMobile && isBattle }">
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
    <div class="main-center">
      <div class="main-center-top">
        <div class="main-center-top-left">
          {{ currentLive?.liveName || liveParams.liveName }}
          <LiveSettingButton
            v-if="loginUserInfo?.userId"
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
        <div class="main-center-top-right">{{ audienceCount }} {{ t('People watching') }}</div>
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
          v-show="isMobile && !isCameraOff && coHostStatus !== CoHostStatus.Connected"
          class="mobile-camera-preview"
        >
          <video
            :id="MOBILE_PREVIEW_VIEW_ID"
            autoplay
            playsinline
            muted
          />
        </div>
      </div>
      <!--
        Mobile-only floating camera controls: flip front/rear and
        toggle the camera off/on. Work both pre-live (our preview
        stream) and in-live (engine switch / close+republish).
      -->
      <div v-if="isMobile" class="mobile-camera-actions">
        <div class="camera-action-btn" @click="toggleMobileCameraFacing">
          <IconCameraSwitch size="22" />
        </div>
        <div class="camera-action-btn" :class="{ 'is-off': isCameraOff }" @click="toggleMobileCameraOff">
          <IconCameraOn v-if="!isCameraOff" size="22" />
          <IconCameraOff v-else size="22" />
        </div>
      </div>
      <!--
        Mobile-only viewer messages. In battle/co-host mode the camera
        tiles are lifted to the top (see .is-battle CSS) and these
        messages fill the space beneath them; in solo mode they float
        TikTok-style over the lower part of the video.
      -->
      <div v-if="isMobile && isInLive" class="mobile-barrage">
        <BarrageList />
      </div>
      <div class="main-center-bottom">
        <div class="main-center-bottom-content">
          <div class="main-center-bottom-left">
            <MicVolumeSetting />
            <SpeakerVolumeSetting />
            <div class="main-center-bottom-tools">
              <CoGuestButton />
              <CoHostButton />
              <OrientationSwitch />
              <LayoutSwitch />
              <SettingButton />
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
              v-else
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
} from 'tuikit-atomicx-vue3';
import CoGuestButton from './component/CoGuestButton.vue';
import CoHostButton from './component/CoHostButton.vue';
import LayoutSwitch from './component/LayoutSwitch.vue';
import LiveSettingButton from './component/LiveSettingButton.vue';
import MicVolumeSetting from './component/MicVolumeSetting.vue';
import OrientationSwitch from './component/OrientationSwitch.vue';
import SettingButton from './component/SettingButton.vue';
import SpeakerVolumeSetting from './component/SpeakerVolumeSetting.vue';
import LivePusherNotification from './component/LivePusherNotification.vue';
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
const { currentBattleInfo } = useBattleState();
const { connected: coGuestConnected } = useCoGuestState();
const { subscribeEvent: subscribeBarrageEvent, unsubscribeEvent: unsubscribeBarrageEvent} = useBarrageState();

const isInLive = computed(() => !!currentLive.value?.liveId);
// Battle / co-host connected: on mobile we lift the two camera tiles up
// and open a viewer-message area beneath them (see .is-battle CSS).
const isBattle = computed(() => coHostStatus.value === CoHostStatus.Connected);
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
  const canvasWidth = 720;
  const canvasHeight = 1280;
  const tileWidth = canvasWidth / 2;
  const tileHeight = 640; // 9:16 halves side by side
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
      // custom stacked layout. The engine applies its own landscape
      // template when the connection forms; apply ours after it (twice,
      // in case of a slow server echo overwriting the first).
      stopMobileCameraPreview();
      setTimeout(() => applyMobileBattleLayout(), 500);
      setTimeout(() => applyMobileBattleLayout(), 2000);
    } else if (prevStatus === CoHostStatus.Connected && status === CoHostStatus.Disconnected) {
      // Back to solo: restore the portrait grid template and bring our
      // own self-view overlay back.
      updateLiveInfo({ layoutTemplate: TUISeatLayoutTemplate.PortraitDynamic_Grid9 });
      startMobileCameraPreview();
    }
  },
);
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
  // Mirror only the selfie camera.
  videoEl.style.transform = isFrontCameraActive.value ? 'scaleX(-1)' : 'none';
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
      mirrorType: isFrontCameraActive.value
        ? TRTCVideoMirrorType.TRTCVideoMirrorType_Enable
        : TRTCVideoMirrorType.TRTCVideoMirrorType_Disable,
    });
  } catch (error) {
    console.warn('[LivePusherView] setLocalRenderParams failed:', error);
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
  if (!isMobile || previewStream || isCameraOff.value
    || coHostStatus.value === CoHostStatus.Connected) {
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
      await applyLocalRenderFit();
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
          // Fix the local self-view fit (see applyLocalRenderFit).
          // Twice — the seat player re-attaches the local view via
          // setLocalVideoView shortly after publishing, which can land
          // after our first call.
          await applyLocalRenderFit();
          setTimeout(() => applyLocalRenderFit(), 1500);
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
const handleEndLive = async () => {
  try {
    loading.value = true;
    exitLiveDialogVisible.value = false;
    await endLive();
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
});

onUnmounted(() => {
  if (autoStartCameraFallbackTimer !== null) {
    window.clearTimeout(autoStartCameraFallbackTimer);
  }
  stopMobileCameraPreview();
  unsubscribeLiveListEvent(LiveListEvent.onLiveEnded, handleLiveEnded);
  unsubscribeBarrageEvent(BarrageEvent.onCustomMessageReceived, handleCustomMessageReceived);
  updateLiveInfo({ layoutTemplate: 0 });
});
</script>

<style lang="scss" scoped>
@import './style/index.scss';

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
      :deep(#atomicx-live-stream-content) video,
      :deep(#atomicx-live-stream-content) canvas {
        object-fit: contain !important;
      }
    }

    // Floating camera controls (flip / on-off), stacked under the
    // top bar on the right, above every video layer.
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
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        cursor: pointer;

        &.is-off {
          background: rgba(220, 53, 69, 0.75);
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
        }

        .main-center-bottom-right {
          width: 100% !important;

          :deep(button) {
            width: 70% !important;
            max-width: 320px !important;
            height: 48px !important;
            margin: 0 auto !important;
            border-radius: 24px !important;
            font-size: 16px !important;
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
          padding: 8px !important;
          background: rgba(0, 0, 0, 0.4) !important;
          border-radius: 50% !important;
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
        background: rgba(0, 0, 0, 0.4) !important;

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
        background: rgba(0, 0, 0, 0.4) !important;
        pointer-events: auto !important;
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

  // Viewer messages overlay. Sits above the bottom controls, messages
  // anchored to the bottom of the band and scrolling up. Non-interactive
  // so taps pass through to the video underneath.
  .mobile-barrage {
    position: absolute !important;
    left: 8px !important;
    right: 8px !important;
    bottom: 150px !important;
    height: 34vh !important;
    z-index: 3 !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: flex-end !important;
    overflow: hidden !important;
    pointer-events: none !important;
    -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 22%) !important;
    mask-image: linear-gradient(180deg, transparent 0, #000 22%) !important;

    // Let the embedded list breathe and stay transparent so it reads as
    // floating chat rather than the desktop side card.
    :deep(*) {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: #fff !important;
      max-width: 100% !important;
    }
    :deep(.barrage-list),
    :deep([class*='barrage']),
    :deep([class*='message-list']) {
      height: 100% !important;
      overflow: hidden !important;
    }
    // Each message pill: subtle dark bubble like TikTok/Bigo.
    :deep([class*='item']) {
      background: rgba(0, 0, 0, 0.32) !important;
      border-radius: 14px !important;
      padding: 5px 10px !important;
      margin: 4px 0 !important;
      width: fit-content !important;
      max-width: 88% !important;
      font-size: 13px !important;
      line-height: 1.35 !important;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6) !important;
    }
  }

  // Battle / co-host: lift both camera tiles into the top half so the
  // viewer messages below them are visible (instead of dead space).
  &.is-battle {
    .main-center-center {
      inset: 44px 0 auto 0 !important;
      height: 50% !important;
    }
    // Give the messages more room: start them right under the tiles.
    .mobile-barrage {
      bottom: 150px !important;
      height: calc(100% - 50% - 44px - 156px) !important;
      min-height: 120px !important;
      -webkit-mask-image: none !important;
      mask-image: none !important;
    }
  }
}
</style>
