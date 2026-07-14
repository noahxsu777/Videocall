<template>
  <header class="live-header">
    <div class="header-left" @click="handleHomeClick">
      <img class="header-left-logo" src="../assets/imgs/logo.svg" alt="logo" />
      <div class="header-left-title">LiveKit</div>
    </div>
    <div class="header-right">
      <TUIButton v-if="isLiveListPage" class="btn-start-live" type="primary" @click="gotoPusher">{{ t('Start live') }}</TUIButton>
      <Avatar :src="loginUserInfo?.avatarUrl" :size="24" />
      <div class="header-right-name">
        {{ loginUserInfo?.userName || loginUserInfo?.userId }}
      </div>
      <div v-if="props.loginButtonVisible" class="header-right-tools">
        <TUIButton v-if="!loginUserInfo" :loading="loginLoading" @click="handleLogin">{{ loginLoading ? t('LoginLoading') : t('Login') }}</TUIButton>
        <TUIButton v-else @click="handleLogout">{{ t('Logout') }}</TUIButton>
      </div>
    </div>
  </header>
</template>


<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { TUIButton, TUIMessageBox, TUIToast, TOAST_TYPE, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { useLoginState, useLiveListState, Avatar, UIKitModal } from 'tuikit-atomicx-vue3';
import { errorHandler } from '../TUILiveKit/utils/errorHandler';
import { useAuth, tencentUserIdFor, displayNameFor } from '../auth/useAuth';
import { SDKAPPID, genTestUserSig } from '../config/basic-info-config';

const { user: authUser, logout: authLogout } = useAuth();

const props = defineProps({
  loginButtonVisible: {
    type: Boolean,
    default: true,
  },
});
const router = useRouter();
const route = useRoute();
const { t } = useUIKit();
const { login, loginUserInfo, logout } = useLoginState();
const { currentLive, endLive } = useLiveListState();
const loginLoading = ref(false);
const isLiveListPage = ref(route.path === '/live-list');

function gotoPusher() {
  router.push({ path: '/live-pusher' });
};

async function handleLogin() {
  try {
    loginLoading.value = true;
    if (!authUser.value) {
      router.push({ path: '/login', query: { from: router.currentRoute.value.path } });
      return;
    }
    const userId = tencentUserIdFor(authUser.value);
    await login({
      userId,
      userSig: genTestUserSig(userId) as string,
      sdkAppId: SDKAPPID,
      userName: displayNameFor(authUser.value),
      testEnv: localStorage.getItem('tuikit-live-env') === 'TestEnv',
    });
  } catch (error) {
    console.error(error);
    const errorInfo = errorHandler.parseError(error);
    UIKitModal.openModal({
      id: errorInfo.code,
      title: t('Login failed'),
      content: t(errorInfo.message),
      type: 'error',
    });
    router.push({ path: '/login', query: { from: router.currentRoute.value.path, ...route.query } });
  } finally {
    loginLoading.value = false;
  }
};

async function proceedLogout() {
  logout();
  sessionStorage.removeItem('tuiLive-userInfo');
  await authLogout();
  router.push({ path: '/login' });
};

function handleLogout() {
  if (currentLive.value?.liveId) {
    TUIMessageBox.confirm({
      title: t('You are currently live streaming. Logging out will automatically end the live stream. Are you sure you want to log out?'),
      showClose: false,
      callback: async (action) => {
        if (action === 'confirm') {
          try {
            await endLive();
          } catch (error) {
            console.warn('End live failed when log out:', error);
            TUIToast({
              message: t('End live failed when log out'),
              type: TOAST_TYPE.ERROR,
            });
            return;
          }
          proceedLogout();
        }
      },
    });
  } else {
    proceedLogout();
  }
};

function handleHomeClick() {
  const hasVConsole = route.query.vConsole === 'true';
  let currentQuery;
  if (hasVConsole) {
    currentQuery = { vConsole: true };
  }
  router.push({ path: '/live-list', query: currentQuery || {} });
}

onMounted(async () => {
  if (loginUserInfo.value && loginUserInfo.value.userId) {
    return;
  }
  await handleLogin();
});

watch(
  () => route.path,
  (newPath) => {
    isLiveListPage.value = newPath === '/live-list';
  },
  { immediate: true },
);

</script>

<style lang="scss" scoped>

.live-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;

  @media (max-width: 768px) {
    padding: 8px 12px !important;
    box-sizing: border-box !important;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
      cursor: pointer;
    }

    .header-left-logo {
      width: 26px;
      height: 24px;
    }

    .header-left-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color-primary);
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .btn-start-live {
      margin-right: 20px;
    }

    .header-right-name {
      font-size: 14px;
      font-weight: 400;
    }
  }
}

</style>
