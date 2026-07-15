-- =====================================================================
-- LiveStream — Supabase schema
-- Run this once in your Supabase project:
--   Dashboard → SQL Editor → New query → paste all of this → Run.
-- Also create a public Storage bucket named "media" (see bottom).
-- =====================================================================

-- ---------- profiles ----------
-- One row per user (mirrors auth.users). Holds the public profile.
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,
  display_name    text,
  bio             text default '',
  avatar_url      text,
  name_updated_at timestamptz,
  vip_until       timestamptz,
  coins           integer not null default 500,
  call_rate       integer not null default 100,
  verified        boolean not null default false,
  is_creator      boolean not null default false,
  is_admin        boolean not null default false,
  banned          boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Safe for existing projects: add the columns if the table already existed.
alter table public.profiles
  add column if not exists name_updated_at timestamptz;
alter table public.profiles
  add column if not exists vip_until timestamptz;
alter table public.profiles
  add column if not exists coins integer not null default 500;
alter table public.profiles
  add column if not exists call_rate integer not null default 100;
alter table public.profiles
  add column if not exists verified boolean not null default false;
alter table public.profiles
  add column if not exists is_creator boolean not null default false;
alter table public.profiles
  add column if not exists is_admin boolean not null default false;
alter table public.profiles
  add column if not exists banned boolean not null default false;

alter table public.profiles enable row level security;

-- "verified", "is_admin" and "banned" can't be set by a direct table
-- update from the app — this trigger silently reverts them — EXCEPT
-- when the update comes from purchase_verification() or one of the
-- admin_* functions below, which flip a transaction-local flag right
-- before writing. That keeps all three un-gameable via the REST API
-- while still letting the legitimate paths (self-purchase, or an
-- admin's action) through. (There's no self-service path to become an
-- admin — the FIRST admin has to be granted by you, the project owner,
-- straight from the Table Editor / SQL Editor, which has no auth.uid()
-- context either. From then on, that admin can use the panel — nothing
-- more is needed by hand.)
create or replace function public.protect_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.bypass_protected_columns', true), '') <> 'on' then
    if new.verified is distinct from old.verified then
      new.verified := old.verified;
    end if;
    if new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
    if new.banned is distinct from old.banned then
      new.banned := old.banned;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_verified on public.profiles;
drop trigger if exists protect_privileged_columns on public.profiles;
create trigger protect_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_privileged_columns();

-- Self-purchase the verified badge with coins. Runs as a single locked
-- read-modify-write so two concurrent purchases can't both succeed off
-- a stale balance, and sets the bypass flag above only for the instant
-- it needs it. Returns the buyer's new coin balance.
create or replace function public.purchase_verification(price integer default 5000)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  current_coins integer;
  already_verified boolean;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select coins, verified into current_coins, already_verified
    from public.profiles where id = uid for update;

  if already_verified then
    raise exception 'already_verified';
  end if;

  if current_coins < price then
    raise exception 'insufficient_coins';
  end if;

  perform set_config('app.bypass_protected_columns', 'on', true);
  update public.profiles set coins = coins - price, verified = true where id = uid;

  return current_coins - price;
end;
$$;

grant execute on function public.purchase_verification(integer) to authenticated;

-- =====================================================================
-- ADMIN PANEL — everything below powers /admin (Settings → "Panel de
-- administración", only shown to accounts with is_admin = true). Every
-- admin_* function re-checks is_current_user_admin() itself — never
-- rely on the client to have hidden the button.
-- =====================================================================

create or replace function public.is_current_user_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- Full account list for the admin panel's "Usuarios" tab, email included
-- (email lives in auth.users, which client code can never query
-- directly — this security-definer function is the only legitimate way
-- to surface it in the UI).
create or replace function public.admin_list_users()
returns table (
  id           uuid,
  email        text,
  username     text,
  display_name text,
  avatar_url   text,
  coins        integer,
  call_rate    integer,
  vip_until    timestamptz,
  verified     boolean,
  is_creator   boolean,
  is_admin     boolean,
  banned       boolean,
  created_at   timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;
  return query
    select p.id, u.email::text, p.username, p.display_name, p.avatar_url, p.coins,
           p.call_rate, p.vip_until, p.verified, p.is_creator, p.is_admin, p.banned, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- Ban / unban an account. Banned accounts are blocked at login by the
-- app (see useAuth.ts) — this function only flips the flag.
create or replace function public.admin_set_banned(target_id uuid, is_banned boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;
  if target_id = auth.uid() and is_banned then
    raise exception 'cannot_ban_self';
  end if;
  perform set_config('app.bypass_protected_columns', 'on', true);
  update public.profiles set banned = is_banned where id = target_id;
end;
$$;

grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;

-- Wallet center: credit or debit any account's coin balance (negative
-- amount = debit). Balance is clamped at 0. Returns the new balance.
create or replace function public.admin_add_coins(target_id uuid, amount integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  new_balance integer;
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;
  update public.profiles set coins = greatest(0, coins + amount) where id = target_id
    returning coins into new_balance;
  if new_balance is null then
    raise exception 'user_not_found';
  end if;
  return new_balance;
end;
$$;

grant execute on function public.admin_add_coins(uuid, integer) to authenticated;

-- Edit any account's profile fields from the admin panel. Pass null for
-- any field you don't want to touch.
create or replace function public.admin_update_profile(
  target_id uuid,
  new_display_name text default null,
  new_username text default null,
  new_bio text default null,
  new_verified boolean default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;
  perform set_config('app.bypass_protected_columns', 'on', true);
  update public.profiles set
    display_name = coalesce(new_display_name, display_name),
    username = coalesce(new_username, username),
    bio = coalesce(new_bio, bio),
    verified = coalesce(new_verified, verified)
  where id = target_id;
end;
$$;

grant execute on function public.admin_update_profile(uuid, text, text, text, boolean) to authenticated;

-- Everyone can read profiles; you can only write your own.
drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- follows ----------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows are viewable by everyone" on public.follows;
create policy "follows are viewable by everyone"
  on public.follows for select using (true);

drop policy if exists "users can follow" on public.follows;
create policy "users can follow"
  on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "users can unfollow" on public.follows;
create policy "users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- ---------- photos ----------
-- "image_url" also holds video URLs when media_type = 'video' (kept the
-- original column name to avoid a rename touching every call site —
-- think of it as "media_url"). Images are compressed client-side into a
-- data URL and stored directly here; videos are too large for that and
-- are uploaded to the "reels-videos" Storage bucket instead (see bottom).
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  image_url  text not null,
  caption    text default '',
  media_type text not null default 'image',
  created_at timestamptz not null default now()
);

alter table public.photos
  add column if not exists media_type text not null default 'image';

alter table public.photos enable row level security;

drop policy if exists "photos are viewable by everyone" on public.photos;
create policy "photos are viewable by everyone"
  on public.photos for select using (true);

drop policy if exists "users can add own photos" on public.photos;
create policy "users can add own photos"
  on public.photos for insert with check (auth.uid() = user_id);

drop policy if exists "users can delete own photos" on public.photos;
create policy "users can delete own photos"
  on public.photos for delete using (auth.uid() = user_id);

-- ---------- likes ----------
create table if not exists public.likes (
  photo_id   uuid not null references public.photos(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

alter table public.likes enable row level security;

drop policy if exists "likes are viewable by everyone" on public.likes;
create policy "likes are viewable by everyone"
  on public.likes for select using (true);

drop policy if exists "users can like" on public.likes;
create policy "users can like"
  on public.likes for insert with check (auth.uid() = user_id);

drop policy if exists "users can unlike" on public.likes;
create policy "users can unlike"
  on public.likes for delete using (auth.uid() = user_id);

-- ---------- comments ----------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  photo_id   uuid not null references public.photos(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

drop policy if exists "comments are viewable by everyone" on public.comments;
create policy "comments are viewable by everyone"
  on public.comments for select using (true);

drop policy if exists "users can comment" on public.comments;
create policy "users can comment"
  on public.comments for insert with check (auth.uid() = user_id);

drop policy if exists "users can delete own comments" on public.comments;
create policy "users can delete own comments"
  on public.comments for delete using (auth.uid() = user_id);

-- ---------- messages (chat 1 a 1) ----------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content      text not null default '',
  kind         text not null default 'text', -- 'text' | 'call'
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists messages_participants_idx
  on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_idx
  on public.messages (recipient_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "participants can read messages" on public.messages;
create policy "participants can read messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "users can send messages" on public.messages;
create policy "users can send messages"
  on public.messages for insert with check (auth.uid() = sender_id);

drop policy if exists "recipients can mark read" on public.messages;
create policy "recipients can mark read"
  on public.messages for update using (auth.uid() = recipient_id);

-- Realtime: entrega mensajes al instante (si falla porque ya estaba
-- agregado, se ignora).
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null; end $$;

-- ---------- push_subscriptions (llamadas entrantes con la app cerrada) ----------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage their own push subscriptions" on public.push_subscriptions;
create policy "users manage their own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nota: enviar el push en sí lo hace la función serverless
-- (web/api/notify-call.ts) con la service role key, que se salta esta
-- política para poder leer las suscripciones de la persona a la que se
-- llama — el usuario normal solo puede leer/crear/borrar la suya.

-- =====================================================================
-- STORAGE: avatars and PHOTOS are compressed on the client and stored
-- inline as data URLs, so no bucket is needed for those. VIDEOS are too
-- large for that, so they need a real Storage bucket:
--   Storage → New bucket → name: reels-videos → Public bucket: ON → Save.
-- No SQL policies needed for it — the app uploads with the logged-in
-- user's own session, and a public bucket allows anyone to read/play.
-- =====================================================================
