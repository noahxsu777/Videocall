import { supabase } from '../auth/supabase';
import type { Profile } from './profiles';
import { saveCache, loadCache } from './offlineCache';

/** One direct (1-to-1) message. kind: 'text' | 'call'. */
export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  kind: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  peer: Profile;
  last: DirectMessage;
  unread: number;
}

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }
  return supabase;
}

/**
 * Build the conversation list from my recent messages (client-side
 * grouping by peer — newest message per peer wins, unread = messages to
 * me without read_at).
 */
const CONVERSATIONS_CACHE_KEY = 'conversations';

export async function listConversations(myId: string): Promise<Conversation[]> {
  try {
    const client = requireClient();
    const { data, error } = await client
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
      .order('created_at', { ascending: false })
      .limit(400);
    if (error) {
      throw new Error(error.message);
    }
    const grouped = new Map<string, { last: DirectMessage; unread: number }>();
    for (const m of (data || []) as DirectMessage[]) {
      const peerId = m.sender_id === myId ? m.recipient_id : m.sender_id;
      if (!grouped.has(peerId)) {
        grouped.set(peerId, { last: m, unread: 0 });
      }
      if (m.recipient_id === myId && !m.read_at) {
        grouped.get(peerId)!.unread += 1;
      }
    }
    const peerIds = [...grouped.keys()];
    if (!peerIds.length) {
      saveCache(myId, CONVERSATIONS_CACHE_KEY, []);
      return [];
    }
    const { data: profs } = await client.from('profiles').select('*').in('id', peerIds);
    const profMap = new Map(((profs || []) as Profile[]).map(p => [p.id, p]));
    const result = peerIds.map(id => ({
      peer:
        profMap.get(id)
        || ({ id, username: null, display_name: 'Usuario', bio: null, avatar_url: null } as Profile),
      last: grouped.get(id)!.last,
      unread: grouped.get(id)!.unread,
    }));
    saveCache(myId, CONVERSATIONS_CACHE_KEY, result);
    return result;
  } catch (error: any) {
    console.warn('[messages] listConversations failed, falling back to cache:', error?.message || error);
    return loadCache<Conversation[]>(myId, CONVERSATIONS_CACHE_KEY)?.data || [];
  }
}

/** Full thread between me and a peer, oldest first. */
export async function fetchThread(myId: string, peerId: string): Promise<DirectMessage[]> {
  const cacheKey = `thread_${peerId}`;
  try {
    const client = requireClient();
    const { data, error } = await client
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${myId},recipient_id.eq.${peerId}),`
        + `and(sender_id.eq.${peerId},recipient_id.eq.${myId})`,
      )
      .order('created_at', { ascending: true })
      .limit(300);
    if (error) {
      throw new Error(error.message);
    }
    const result = (data || []) as DirectMessage[];
    saveCache(myId, cacheKey, result);
    return result;
  } catch (error: any) {
    console.warn('[messages] fetchThread failed, falling back to cache:', error?.message || error);
    return loadCache<DirectMessage[]>(myId, cacheKey)?.data || [];
  }
}

export async function sendDirectMessage(
  senderId: string,
  recipientId: string,
  content: string,
  kind = 'text',
  senderInfo?: { name?: string; avatar?: string | null },
): Promise<DirectMessage> {
  const client = requireClient();
  const { data, error } = await client
    .from('messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, content, kind })
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }
  // Fire a native push so the recipient is notified even with the app
  // closed/backgrounded (Realtime only reaches an already-open tab).
  // Best-effort — never blocks or fails the send if push isn't configured.
  void sendMessagePushNotification(recipientId, senderId, content, kind, senderInfo);
  return data as DirectMessage;
}

async function sendMessagePushNotification(
  recipientId: string,
  senderId: string,
  content: string,
  kind: string,
  senderInfo?: { name?: string; avatar?: string | null },
): Promise<void> {
  try {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return;
    }
    const preview =
      kind === 'text'
        ? content
        : kind === 'image'
          ? '📷 Foto'
          : kind === 'gif'
            ? 'GIF 🎞️'
            : kind === 'video'
              ? '🎥 Video'
              : 'Nuevo mensaje';
    await fetch('/api/notify-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recipientId,
        senderId,
        senderName: senderInfo?.name || '',
        senderAvatar: senderInfo?.avatar || null,
        preview,
      }),
    });
  } catch (error) {
    console.warn('[messages] push notify failed (message still delivered):', error);
  }
}

/** Mark everything the peer sent me as read. */
export async function markThreadRead(myId: string, peerId: string): Promise<void> {
  const client = requireClient();
  await client
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', myId)
    .eq('sender_id', peerId)
    .is('read_at', null);
}

/**
 * Realtime: fire the callback whenever someone sends ME a new message.
 * Returns an unsubscribe function. (The UI also polls as a fallback in
 * case realtime isn't enabled on the table.)
 */
export function subscribeInbox(
  myId: string,
  onMessage: (m: DirectMessage) => void,
): () => void {
  if (!supabase) {
    return () => {};
  }
  const channel = supabase
    .channel(`dm-inbox-${myId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${myId}` },
      (payload: any) => onMessage(payload.new as DirectMessage),
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

/** Search users by name/@handle (excluding myself). */
export async function searchUsers(myId: string, query: string): Promise<Profile[]> {
  const client = requireClient();
  const q = query.replace(/[%_]/g, '');
  if (!q) {
    return [];
  }
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq('id', myId)
    .limit(15);
  if (error) {
    console.warn('[messages] searchUsers failed:', error.message);
    return [];
  }
  return (data || []) as Profile[];
}

/** Profiles I follow — quick-start suggestions for a new chat. */
export async function listFollowingProfiles(myId: string): Promise<Profile[]> {
  const client = requireClient();
  const { data: rows } = await client
    .from('follows')
    .select('following_id')
    .eq('follower_id', myId)
    .limit(50);
  const ids = (rows || []).map((r: any) => r.following_id);
  if (!ids.length) {
    return [];
  }
  const { data } = await client.from('profiles').select('*').in('id', ids);
  return (data || []) as Profile[];
}
