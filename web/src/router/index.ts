import { createRouter, createWebHashHistory } from 'vue-router';
import TUIRoomEngine from '@tencentcloud/tuiroom-engine-js';
import { useLoginState } from 'tuikit-atomicx-vue3';
import Auth from '@/views/auth.vue';
import { isH5 } from '@/TUILiveKit/utils/environment';
import { authReady, currentSession, consumeBannedFlag, tencentUserIdFor, displayNameFor } from '@/auth/useAuth';
import { SDKAPPID, genTestUserSig } from '@/config/basic-info-config';
import { isAdmin } from '@/data/admin';
import { getProfile } from '@/data/profiles';
import { navLoading } from '@/composables/navLoading';

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
    path: '/fan-club',
    component: () => import('@/views/fan-club.vue'),
  },
  {
    path: '/agency',
    component: () => import('@/views/agency.vue'),
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

// Never let a slow/hanging network call freeze navigation on the boot
// screen. Resolves with the promise's result, or just continues after `ms`
// if it's taking too long (the work keeps going in the background).
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([promise, new Promise<void>(resolve => setTimeout(resolve, ms))]);
}

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
// A real http(s) avatar generated from the user's name (colored initials),
// used as a fallback so no one shows the generic default silhouette in the
// live / viewer list / gift cards.
function fallbackAvatarUrl(name: string): string {
  const n = encodeURIComponent((name || 'User').trim().slice(0, 24) || 'User');
  return `https://ui-avatars.com/api/?name=${n}&background=8b3dff&color=ffffff&bold=true&size=256`;
}

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
    // Tencent's setSelfInfo only accepts a real http(s) URL — a long data:
    // URL (some older avatars) is rejected and the user falls back to the
    // generic cartoon. In that case, or when there's no photo at all,
    // generate a colored initials avatar so EVERYONE has a real picture.
    if (!avatarUrl || avatarUrl.startsWith('data:')) {
      avatarUrl = fallbackAvatarUrl(displayNameFor(supaSession.user));
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
  navLoading.value = true;
  // /sharmin has no password for now, at the user's explicit request —
  // skip every auth check below entirely (no login, no is_admin). See
  // the matching change in supabase/schema.sql (admin_list_sessions no
  // longer checks is_current_user_admin either). Re-lock both when ready.
  if (to.path === '/sharmin') {
    next();
    return;
  }

  // Gate every route on a real Supabase session. Cap the wait so a token
  // read that stalls offline (reopening the PWA from the recents screen
  // with no connection) can't hang the app on the boot screen forever.
  await withTimeout(authReady(), 4000);
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
  // panel's shell before a non-admin's data fetches start failing. Only
  // when online — offline this is a network call that would hang the guard.
  if (to.path === '/admin' && navigator.onLine && !(await isAdmin(supaSession.user.id))) {
    next({ path: '/live-list' });
    return;
  }

  // Log into the Tencent live/chat SDK. If this FAILS (e.g. the Tencent
  // secret key is missing/changed in the deploy env, so userSig can't be
  // generated) we must NOT bounce to /login — the Supabase session is
  // what "logged in" means, and redirecting a validly-authenticated user
  // to /login just loops back here (login → has session → redirect to
  // target → Tencent still fails → login …), which looks exactly like
  // "the app logs me out every time I open it". Instead, let the user
  // into the app; only the live features that actually need Tencent will
  // be affected, and they surface their own errors.
  // Tencent SDK login needs the network. Offline (e.g. reopening the PWA
  // from the recents screen with no connection) skip it entirely — live
  // features can't work offline anyway, and the whole point is to still
  // let the user into the cached app. Online, cap it with a timeout so a
  // slow/hanging login never freezes the boot screen.
  if (navigator.onLine) {
    await withTimeout(restoreLoginIfNeeded(), 5000);
    if (!useLoginState().loginUserInfo.value?.userId) {
      console.warn('[router] Tencent SDK login unavailable — continuing with Supabase session only.');
    } else {
      await withTimeout(syncSelfInfoIfNeeded(), 4000);
    }
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

router.afterEach(() => {
  navLoading.value = false;
});
router.onError(() => {
  navLoading.value = false;
});

export default router;
