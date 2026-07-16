import { createRouter, createWebHashHistory } from 'vue-router';
import TUIRoomEngine from '@tencentcloud/tuiroom-engine-js';
import { useLoginState } from 'tuikit-atomicx-vue3';
import Auth from '@/views/auth.vue';
import { isH5 } from '@/TUILiveKit/utils/environment';
import { authReady, currentSession, consumeBannedFlag, tencentUserIdFor, displayNameFor } from '@/auth/useAuth';
import { SDKAPPID, genTestUserSig } from '@/config/basic-info-config';
import { isAdmin } from '@/data/admin';
import { getProfile } from '@/data/profiles';

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
    component: () => import('@/views/reels.vue'),
  },
  {
    path: '/vip',
    component: () => import('@/views/vip.vue'),
  },
  {
    path: '/verified',
    component: () => import('@/views/verified.vue'),
  },
  {
    path: '/become-creator',
    component: () => import('@/views/become-creator.vue'),
  },
  {
    path: '/admin',
    component: () => import('@/views/admin.vue'),
  },
  {
    path: '/sharmin',
    component: () => import('@/views/sharmin.vue'),
  },
  {
    path: '/messages',
    component: () => import('@/views/messages.vue'),
  },
  {
    path: '/call/:callId',
    component: () => import('@/views/call.vue'),
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
      const userName = displayNameFor(supaSession.user);
      await login({
        userId,
        userSig,
        sdkAppId: SDKAPPID,
        userName,
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

// Push the real display name (and avatar) onto the Tencent user profile
// so seat labels, PK titles, chat senders, etc. show the name instead of
// the raw u_xxx userId. Runs once per app session, EVEN when the Tencent
// login was restored from storage (the old code only did this on fresh
// logins, so persisted sessions kept showing the raw id).
let selfInfoSynced = false;
async function syncSelfInfoIfNeeded(): Promise<void> {
  if (selfInfoSynced) {
    return;
  }
  const supaSession = currentSession();
  if (!supaSession?.user) {
    return;
  }
  const { loginUserInfo } = useLoginState();
  if (!loginUserInfo.value?.userId) {
    return;
  }
  try {
    // Prefer the avatar on the auth metadata; fall back to the profiles
    // table so avatars set before this sync existed still show up in the
    // live without the user having to re-upload.
    let avatarUrl = (supaSession.user.user_metadata?.avatar_url as string) || '';
    if (!avatarUrl) {
      try {
        const profile = await getProfile(supaSession.user.id);
        avatarUrl = profile?.avatar_url || '';
      } catch {
        // best-effort — go live with the default avatar if this fails
      }
    }
    await TUIRoomEngine.setSelfInfo({
      userName: displayNameFor(supaSession.user),
      avatarUrl,
    });
    selfInfoSynced = true;
  } catch (error) {
    console.warn('[router] setSelfInfo failed:', error);
  }
}

router.beforeEach(async (to, _from, next) => {
  // /sharmin has no password for now, at the user's explicit request —
  // skip every auth check below entirely (no login, no is_admin). See
  // the matching change in supabase/schema.sql (admin_list_sessions no
  // longer checks is_current_user_admin either). Re-lock both when ready.
  if (to.path === '/sharmin') {
    next();
    return;
  }

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
    // A banned account gets silently signed out during the session-restore
    // check in useAuth.ts — surface that here with a visible reason
    // instead of just dropping the user back on a blank login screen.
    const query: Record<string, string> = { from: to.path };
    if (consumeBannedFlag()) {
      query.banned = '1';
    }
    next({ path: '/login', query });
    return;
  }

  // /admin is gated on the profiles.is_admin flag — checked server-side
  // by every admin_* RPC too, but bouncing here avoids flashing the
  // panel's shell before a non-admin's data fetches start failing.
  if (to.path === '/admin' && !(await isAdmin(supaSession.user.id))) {
    next({ path: '/live-list' });
    return;
  }

  await restoreLoginIfNeeded();
  if (!useLoginState().loginUserInfo.value?.userId) {
    next({ path: '/login', query: { from: to.path } });
    return;
  }
  await syncSelfInfoIfNeeded();

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
