// "Para ti" recommendation ranking for the Reels feed.
//
// A lightweight, fully client-side scoring model — no server needed. Given
// a pool of recent posts plus signals about the viewer (who they follow,
// which creators they tend to like, engagement counts), it ranks posts so
// the feed leans toward what this person actually enjoys watching, while
// still mixing in fresh and popular content for discovery.

import type { FeedPhoto } from './profiles';

export interface RankSignals {
  followingIds: Set<string>;
  authorAffinity: Record<string, number>; // creatorId -> how many of their posts the viewer liked
  likedPhotoIds: Set<string>;
  stats: Record<string, { likes: number; comments: number }>;
  myId?: string;
}

// Relative importance of each signal. Tuned so personal taste (affinity +
// following) leads, popularity and freshness support it, and a little
// randomness keeps the feed from feeling static on every open.
const W_AFFINITY = 3.2;
const W_FOLLOW = 1.6;
const W_POPULARITY = 1.1;
const W_RECENCY = 1.4;
const W_JITTER = 0.6;
const SEEN_PENALTY = 1.8; // downrank posts already liked (still allowed, just lower)
const OWN_PENALTY = 2.5; // your own posts rarely belong in "For You"

const DAY_MS = 24 * 60 * 60 * 1000;

function recencyScore(createdAt: string): number {
  const ageDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / DAY_MS);
  // 1.0 today, ~0.5 at 3 days, tailing off after a week.
  return 1 / (1 + ageDays / 3);
}

function popularityScore(likes: number, comments: number): number {
  // Comments are a stronger engagement signal than a like. Log-scaled so a
  // few viral posts don't completely bury everything else.
  return Math.log1p(likes + comments * 2) / Math.log(50);
}

/** Score a single post for this viewer. Higher = show sooner. */
export function scorePost(photo: FeedPhoto, signals: RankSignals): number {
  const authorId = photo.user_id;
  const st = signals.stats[photo.id] || { likes: 0, comments: 0 };

  const affinity = Math.min(1, (signals.authorAffinity[authorId] || 0) / 3);
  const follows = signals.followingIds.has(authorId) ? 1 : 0;
  const popularity = Math.min(1, popularityScore(st.likes, st.comments));
  const recency = recencyScore(photo.created_at);
  const jitter = Math.random();

  let score =
    affinity * W_AFFINITY +
    follows * W_FOLLOW +
    popularity * W_POPULARITY +
    recency * W_RECENCY +
    jitter * W_JITTER;

  if (signals.likedPhotoIds.has(photo.id)) {
    score -= SEEN_PENALTY;
  }
  if (signals.myId && authorId === signals.myId) {
    score -= OWN_PENALTY;
  }
  return score;
}

/** Rank a candidate pool into a personalized "Para ti" ordering. */
export function rankForYou(photos: FeedPhoto[], signals: RankSignals): FeedPhoto[] {
  return photos
    .map(p => ({ p, s: scorePost(p, signals) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.p);
}
