import { createRouter, createWebHashHistory } from 'vue-router';
import { useLoginState } from 'tuikit-atomicx-vue3';
import Auth from '@/views/auth.vue';
import { isH5 } from '@/TUILiveKit/utils/environment';
import { authReady, currentSession, tencentUserIdFor, displayNameFor } from '@/auth/useAuth';
import { SDKAPPID, genTestUserSig } from '@/config/basic-info-config';

const routes = [
  {
    path: '/',
    redirect: '/live-list',
  },
  {
    path: '/login',
    component: Auth,
  },
  {
    path: '/live-list',
    component: () => import('@/views/live-list.vue'),
  },
  {
    path: '/reels',
    component: () => import('@/views/placeholder.vue'),
  },
  {
    path: '/messages',
    component: () => import('@/views/placeholder.vue'),
  },
  {
    path: '/profile',
    component: () => import('@/views/profile.vue'),
  },
  {
    path: '/profile/:id',
    component: () => import('@/views/profile.vue'),
  },
  {
    path: '/settings',
    component: () => import('@/views/settings.vue'),
  },
  {
    path: '/live-player',
    component: () => import('@/views/live-player.vue'),
  },
  {
    path: '/live-pusher',
    component: () => import('@/views/live-pusher.vue'),
  },
  // Business style routes — isolated under /business prefix
  {
    path: '/business/live-player',
    component: () => import('@/scenes/business/views/business-live-player.vue'),
  },
  // Education style routes — isolated under /education prefix
  {
    path: '/education/live-player',
    component: () => import('@/scenes/education/views/education-live-player.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

type StylePreset = '' | 'business' | 'education';

function normalizeStylePreset(value: unknown): StylePreset {
  if (value === 'business' || value === 'education') {
    return value;
  }
  return '';
}

function getActiveStylePreset(routeQuery: Record<string, any>): StylePreset {
  if (isH5) {
    return '';
  }
  const queryPreset = normalizeStylePreset(routeQuery.stylePreset);
  if (queryPreset) {
    return queryPreset;
  }
  const stored = localStorage.getItem('tuikit-style-preset');
  return normalizeStylePreset(stored);
}

let restoreLoginPromise: Promise<void> | null = null;

// Log into the Tencent live/chat SDK using the authenticated Supabase
// user (its id becomes the Tencent userID, its display name the
// userName). userSig is still generated client-side from the SDK secret
// key for now (dev/demo) — see basic-info-config.js.
async function restoreLoginIfNeeded(): Promise<void> {
  const { loginUserInfo, login } = useLoginState();
  if (loginUserInfo.value?.userId) {
    return;
  }
  if (restoreLoginPromise) {
    return restoreLoginPromise;
  }
  const supaSession = currentSession();
  if (!supaSession?.user) {
    return;
  }
  restoreLoginPromise = (async () => {
    try {
      const userId = tencentUserIdFor(supaSession.user);
      const userSig = genTestUserSig(userId) as string;
      await login({
        userId,
        userSig,
        sdkAppId: SDKAPPID,
        userName: displayNameFor(supaSession.user),
        testEnv: localStorage.getItem('tuikit-live-env') === 'TestEnv',
      });
    } catch (error) {
      console.error('[router] Failed to log into Tencent SDK:', error);
    } finally {
      restoreLoginPromise = null;
    }
  })();
  return restoreLoginPromise;
}

router.beforeEach(async (to, _from, next) => {
  // Gate every route on a real Supabase session.
  await authReady();
  const supaSession = currentSession();

  if (to.path === '/login') {
    // Already logged in? Skip the auth screen.
    if (supaSession) {
      next({ path: (to.query.from as string) || '/live-list' });
    } else {
      next();
    }
    return;
  }

  if (!supaSession) {
    next({ path: '/login', query: { from: to.path } });
    return;
  }

  await restoreLoginIfNeeded();
  if (!useLoginState().loginUserInfo.value?.userId) {
    next({ path: '/login', query: { from: to.path } });
    return;
  }

  if (isH5) {
    if (to.path === '/business/live-player' || to.path === '/education/live-player') {
      const query = { ...to.query };
      delete query.stylePreset;
      next({ path: '/live-player', query });
      return;
    }
    if (to.query.stylePreset) {
      const query = { ...to.query };
      delete query.stylePreset;
      next({ path: to.path, query });
      return;
    }
  }

  // Redirect to style route when style preset is active
  // (from URL param or UIKitProvider stylePreset prop)
  const activeStylePreset = getActiveStylePreset(to.query);
  if (to.path === '/live-player' && activeStylePreset) {
    const query = { ...to.query };
    delete query.stylePreset;
    next({ path: `/${activeStylePreset}/live-player`, query });
    return;
  }

  // Strip stylePreset param if already on style route to avoid re-render
  if ((to.path === '/business/live-player' || to.path === '/education/live-player') && to.query.stylePreset) {
    const query = { ...to.query };
    delete query.stylePreset;
    next({ path: to.path, query });
    return;
  }

  next();
});

export default router;
