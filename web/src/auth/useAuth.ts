import { ref, computed } from 'vue';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

// Shared reactive auth state (module singletons so every component sees
// the same session).
const session = ref<Session | null>(null);
const initializing = ref(true);
let initialized = false;

/**
 * A stable Tencent-friendly userId derived from the Supabase user.
 * Tencent userID only allows letters, numbers, underscore — so we strip
 * the UUID's dashes. This is what we pass to the live/chat SDK as userID.
 */
export function tencentUserIdFor(user: User | null): string {
  if (!user) {
    return '';
  }
  return `u_${user.id.replace(/-/g, '')}`.slice(0, 32);
}

export function displayNameFor(user: User | null): string {
  if (!user) {
    return '';
  }
  return (
    (user.user_metadata?.display_name as string | undefined)
    || user.email?.split('@')[0]
    || 'user'
  );
}

let initPromise: Promise<void> | null = null;

/** Signs the current session out (silently) if the account has been
 *  banned from the admin panel. Used both on session restore and right
 *  after a fresh login. */
async function signOutIfBanned(userId: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }
  const { data } = await supabase.from('profiles').select('banned').eq('id', userId).maybeSingle();
  if (data?.banned) {
    await supabase.auth.signOut();
    session.value = null;
    return true;
  }
  return false;
}

function ensureInitialized(): Promise<void> {
  if (initialized || !supabase) {
    initializing.value = false;
    return Promise.resolve();
  }
  if (initPromise) {
    return initPromise;
  }
  initialized = true;
  initPromise = (async () => {
    const { data } = await supabase!.auth.getSession();
    session.value = data.session;
    if (session.value?.user) {
      await signOutIfBanned(session.value.user.id);
    }
    supabase!.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession;
    });
    initializing.value = false;
  })();
  return initPromise;
}

/** Resolves once the initial session has been read — for router guards. */
export function authReady(): Promise<void> {
  return ensureInitialized();
}

/** Current Supabase user without needing the composable (for guards). */
export function currentSession(): Session | null {
  return session.value;
}

export function useAuth() {
  ensureInitialized();

  const user = computed(() => session.value?.user ?? null);
  const isLoggedIn = computed(() => !!session.value);

  const register = async (params: {
    email: string;
    password: string;
    displayName: string;
  }) => {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: { display_name: params.displayName },
      },
    });
    if (error) {
      throw error;
    }
    return data;
  };

  const login = async (params: { email: string; password: string }) => {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });
    if (error) {
      throw error;
    }
    if (data.user && (await signOutIfBanned(data.user.id))) {
      throw new Error('Tu cuenta ha sido suspendida.');
    }
    return data;
  };

  const logout = async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    session.value = null;
  };

  return {
    isSupabaseConfigured,
    initializing,
    session,
    user,
    isLoggedIn,
    tencentUserId: computed(() => tencentUserIdFor(user.value)),
    displayName: computed(() => displayNameFor(user.value)),
    register,
    login,
    logout,
  };
}
