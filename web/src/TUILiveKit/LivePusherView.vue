<template>
  <!--
    The is-mobile class (user-agent based, orientation-independent)
    gates the full-screen mobile styling — a width media query alone
    missed phones held in landscape, which fell back to the desktop
    3-column studio layout.
  -->
  <div id="live-pusher-view" class="live-pusher-main" :class="{ 'is-mobile': isMobile }">
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
          autoStartMobileCamera), so the manual source picker
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
        <StreamMixer />
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
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue';
import TUIRoomEngine, { TUISeatMode, TRTCMediaSourceType } from '@tencentcloud/tuiroom-engine-js';
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
  useDeviceState,
  useCoHostState,
  useBattleState,
  CoHostStatus,
  useCoGuestState,
  useRoomEngine,
  useVideoMixerState,
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
const { openLocalMicrophone, cameraList, getCameraList } = useDeviceState();
const { coHostStatus, exitHostConnection } = useCoHostState();
const { currentBattleInfo } = useBattleState();
const { connected: coGuestConnected } = useCoGuestState();
const { subscribeEvent: subscribeBarrageEvent, unsubscribeEvent: unsubscribeBarrageEvent} = useBarrageState();
const { mediaSourceList, addMediaSource, enableLocalVideoMixer } = useVideoMixerState();

const isInLive = computed(() => !!currentLive.value?.liveId);
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

// Auto-start the phone's camera on mobile so the broadcaster sees
// themselves full-screen immediately, without having to tap
// "Add Camera" first (matches Tango/Bigo — no manual source picker).
//
// This mirrors what the real "Add Camera" dialog does: enumerate the
// device's cameras and pass a REAL deviceId plus a resolution.
// The previous version passed an invented cameraId of 'default',
// which the underlying media source manager rejects — that was the
// actual reason auto-start kept failing (with a permission toast)
// even after the user had granted camera permission.
// Deduped as a shared promise (instead of a boolean flag) so a second
// caller — e.g. handleStartLive's safety net while the on-mount attempt
// is still running — awaits the in-flight attempt rather than skipping
// and going live camera-less.
let autoStartCameraPromise: Promise<void> | null = null;
const autoStartMobileCamera = (): Promise<void> => {
  if (!isMobile || mediaSourceList.value.length > 0) {
    return Promise.resolve();
  }
  if (autoStartCameraPromise) {
    return autoStartCameraPromise;
  }
  autoStartCameraPromise = (async () => {
    try {
      // Trigger/settle the permission prompt before enumerating —
      // browsers report blank deviceIds until camera permission is
      // granted, which would leave us with nothing usable to pass.
      const probeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      probeStream.getTracks().forEach(track => track.stop());

      await getCameraList();
      const cameras = cameraList.value;
      if (!cameras.length || !cameras[0].deviceId) {
        throw new Error('no usable camera devices found');
      }
      // Prefer the front-facing camera when we can identify it by name;
      // otherwise fall back to the first camera, same as the dialog.
      const frontCamera = cameras.find(
        device => /front|user|frontal|delantera/i.test(device.deviceName || ''),
      ) || cameras[0];

      // The mixer's internal media source manager finishes initializing
      // asynchronously some time after engine-ready, and addMediaSource
      // has no readiness guard of its own — retry with backoff instead
      // of giving up on the first race.
      let lastError: unknown;
      for (const delayMs of [0, 800, 2000, 4000]) {
        if (delayMs) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        if (mediaSourceList.value.length > 0) {
          return;
        }
        try {
          // The mixer plugin must be enabled before adding sources —
          // LocalMixer fires enableLocalVideoMixer() on mount without
          // awaiting it, and racing it produced the on-device
          // "updatePlugin abort" failure. Awaiting it here (idempotent)
          // guarantees the plugin is up for THIS call.
          await enableLocalVideoMixer();
          // `id` is REQUIRED by the media source manager ("'id' is a
          // required param" — the exact on-device failure). The real
          // "Add Camera" flow generates it as `${type}_${nanoid(5)}`;
          // mirror that format here.
          await addMediaSource({
            id: `${TRTCMediaSourceType.kCamera}_${Math.random().toString(36).slice(2, 7)}`,
            type: TRTCMediaSourceType.kCamera,
            name: frontCamera.deviceName,
            camera: {
              cameraId: frontCamera.deviceId,
              resolution: { width: 720, height: 1280 },
            },
          } as Parameters<typeof addMediaSource>[0]);
          return;
        } catch (error) {
          lastError = error;
          console.error('[LivePusherView] auto-start camera attempt failed, retrying:', error);
        }
      }
      throw lastError;
    } catch (error) {
      console.error('[LivePusherView] Failed to auto-start camera:', error);
      // Include the underlying reason so on-device failures are
      // diagnosable from the toast alone (the console isn't reachable
      // on a phone).
      const reason = (error as Error)?.message || String(error);
      TUIToast.error({
        message: `${t('Please check the current browser camera permission')} (${reason})`,
      });
    } finally {
      autoStartCameraPromise = null;
    }
  })();
  return autoStartCameraPromise;
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
    // Safety net: if the on-mount camera auto-start failed or hasn't
    // completed (e.g. the user only just granted permission), make sure
    // the camera is up before going live. No-ops when a source exists.
    await autoStartMobileCamera();
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
    joinLive({
      liveId: liveParams.value.liveId,
    });
    loading.value = false;
    openLocalMicrophone();
  } catch (error: any) {
    loading.value = false;
    if (typeof error.message === 'string'
      && error.message.indexOf('this room already exists, and you are the owner') !== -1) {
      await joinLive({
        liveId: liveParams.value.liveId,
      });
      await openLocalMicrophone();
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
  // Wait for the DOM update AND for TUIRoomEngine's own WASM engine to
  // report ready before touching the video mixer. A plain nextTick()
  // (DOM-only) wasn't enough — the WASM engine's own init ("TUIRoomEngineWASM
  // ready!" in the console) can still be in flight after Vue's next tick,
  // and calling addMediaSource before it's done failed silently (caught,
  // logged, never surfaced), which is what kept showing "No video" with
  // no obvious cause. TUIRoomEngine.once('ready', ...) is the same pattern
  // already used elsewhere in this app (see live-pusher.vue) and fires
  // immediately if the engine is already ready by the time we register it.
  await nextTick();
  TUIRoomEngine.once('ready', () => {
    autoStartMobileCamera();
  });
  // Defensive fallback in case the 'ready' event above never fires for
  // this listener (e.g. some edge case in event timing) — autoStartMobileCamera
  // is a no-op if a source was already added, so this is safe to also run.
  autoStartCameraFallbackTimer = window.setTimeout(() => {
    autoStartMobileCamera();
  }, 2000);
});

onUnmounted(() => {
  if (autoStartCameraFallbackTimer !== null) {
    window.clearTimeout(autoStartCameraFallbackTimer);
  }
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
// auto-starts (see autoStartMobileCamera) so the manual source picker is
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
}
</style>
