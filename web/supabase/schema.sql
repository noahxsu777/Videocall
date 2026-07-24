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
alter table public.profiles
  add column if not exists verification_requested boolean not null default false;
alter table public.profiles
  add column if not exists verification_note text;
-- Saldo + cuenta de retiro Stripe. Dos bolsillos con el mismo nombre
-- "Coins": profiles.coins = saldo para GASTAR (compras + bono de
-- registro); profiles.earned_coins = saldo RETIRABLE (solo regalos
-- recibidos transmitiendo) — así lo recargado nunca se puede retirar.
alter table public.profiles
  add column if not exists stripe_account_id text;
alter table public.profiles
  add column if not exists earned_coins integer not null default 0;

alter table public.profiles enable row level security;

-- Libro de ganancias (pestaña Transacciones → Ganancias): regalos en
-- lives y videollamadas cobradas. Solo lectura propia; escriben los RPCs.
create table if not exists public.coin_earnings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  source     text not null default 'live', -- 'live' | 'call'
  coins      integer not null,
  created_at timestamptz not null default now()
);
alter table public.coin_earnings enable row level security;
drop policy if exists "users read own earnings" on public.coin_earnings;
create policy "users read own earnings"
  on public.coin_earnings for select using (auth.uid() = user_id);

-- Acumula los Coins ganados por regalos recibidos en un live al bolsillo
-- RETIRABLE y lo registra en el libro. Ligado a auth.uid().
create or replace function public.add_earned_coins(amount integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if amount <= 0 then return; end if;
  update public.profiles set earned_coins = earned_coins + amount where id = auth.uid();
  insert into public.coin_earnings (user_id, source, coins) values (auth.uid(), 'live', amount);
end;
$$;
grant execute on function public.add_earned_coins(integer) to authenticated;

-- Cobro de videollamada: descuenta coins GASTABLES del que llama
-- (auth.uid()), acredita coins RETIRABLES al que recibe y lo registra en
-- el libro. Atómico y a prueba de RLS (el cliente no puede tocar la fila
-- de otro usuario directamente). Devuelve el nuevo saldo del pagador.
create or replace function public.transfer_call_coins(payee uuid, amount integer)
returns integer language plpgsql security definer set search_path = public as $$
declare payer uuid := auth.uid(); bal integer; charge integer;
begin
  if payer is null then raise exception 'not_authenticated'; end if;
  if payee = payer then raise exception 'self_transfer'; end if;
  select coins into bal from public.profiles where id = payer for update;
  charge := least(coalesce(bal, 0), greatest(0, amount));
  if charge <= 0 then return coalesce(bal, 0); end if;
  update public.profiles set coins = coins - charge where id = payer;
  update public.profiles set earned_coins = earned_coins + charge where id = payee;
  insert into public.coin_earnings (user_id, source, coins) values (payee, 'call', charge);
  return bal - charge;
end;
$$;
grant execute on function public.transfer_call_coins(uuid, integer) to authenticated;

-- Totales de ganancias por fuente (Live vs Videollamadas), ALL-time — la
-- pantalla Saldo los muestra como dos montos en dólares separados.
create or replace function public.get_earnings_totals()
returns table(source text, total integer)
language sql stable security definer set search_path = public as $$
  select source, sum(coins)::integer as total
  from public.coin_earnings
  where user_id = auth.uid()
  group by source;
$$;
grant execute on function public.get_earnings_totals() to authenticated;

-- Libro de compras de Coins (Stripe Checkout). La PK por sesión evita
-- acreditar dos veces la misma compra. Sin políticas: solo el service
-- role (api/stripe-checkout-verify.js) lee/escribe.
create table if not exists public.coin_purchases (
  session_id text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  coins      integer not null,
  usd_cents  integer not null,
  created_at timestamptz not null default now()
);
alter table public.coin_purchases enable row level security;
-- Cada quien puede VER sus compras (pestaña Transacciones); solo el
-- service role escribe.
drop policy if exists "users read own coin purchases" on public.coin_purchases;
create policy "users read own coin purchases"
  on public.coin_purchases for select using (auth.uid() = user_id);

-- Libro de retiros (pestaña Transacciones). Solo el service role escribe
-- (api/stripe-payout.js); cada quien lee los suyos.
create table if not exists public.coin_payouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  coins      integer not null,
  usd_cents  integer not null,
  fee_cents  integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.coin_payouts enable row level security;
drop policy if exists "users read own payouts" on public.coin_payouts;
create policy "users read own payouts"
  on public.coin_payouts for select using (auth.uid() = user_id);

-- Registro de cada live terminado (pantalla Estadísticas: horas, coins,
-- rachas). El host inserta el suyo al cortar; cada quien lee los suyos.
create table if not exists public.live_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  duration_seconds integer not null default 0,
  coins_earned     integer not null default 0,
  viewers          integer not null default 0,
  created_at       timestamptz not null default now()
);
alter table public.live_sessions enable row level security;
drop policy if exists "users insert own live sessions" on public.live_sessions;
create policy "users insert own live sessions"
  on public.live_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "users read own live sessions" on public.live_sessions;
create policy "users read own live sessions"
  on public.live_sessions for select using (auth.uid() = user_id);

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

-- ---------- Verificación por SOLICITUD (aprobada desde /sharmin) ----------
-- A user requests the blue check; you approve/reject it from the /sharmin
-- panel. request_verification just flags the user's own row. list/set are
-- PUBLIC (anon) to match /sharmin having no password for now — that means
-- ANYONE hitting the API could approve a verification, so re-lock these
-- (add "if not public.is_current_user_admin() then raise exception ...")
-- when you lock /sharmin back down.
create or replace function public.request_verification(note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.profiles set verification_requested = true, verification_note = note where id = uid;
end;
$$;
grant execute on function public.request_verification(text) to authenticated;

create or replace function public.list_verification_requests()
returns table (user_id uuid, email text, username text, display_name text, avatar_url text, verified boolean, note text, requested_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select p.id, u.email::text, p.username, p.display_name, p.avatar_url, p.verified, p.verification_note, p.created_at
    from public.profiles p join auth.users u on u.id = p.id
    where p.verification_requested = true
    order by p.created_at desc;
end;
$$;
grant execute on function public.list_verification_requests() to authenticated, anon;

create or replace function public.set_verification(target_id uuid, approved boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.bypass_protected_columns', 'on', true);
  update public.profiles set verified = approved, verification_requested = false where id = target_id;
end;
$$;
grant execute on function public.set_verification(uuid, boolean) to authenticated, anon;

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

-- ---------- user_sessions (admin-only IP / device log, /sharmin) ----------
-- One row per account, updated every time the app boots (see
-- api/log-visit.ts + src/data/sessionLog.ts). Deliberately has NO select,
-- insert or update policy at all: RLS defaults to deny-all, so the ONLY
-- way to read this table is admin_list_sessions() below, and the ONLY
-- way to write it is api/log-visit.ts using the service-role key (which
-- bypasses RLS entirely). That matters because the IP has to come from
-- the HTTP request itself to mean anything — a policy that let a client
-- write its own row directly would let it just lie about its own IP.
create table if not exists public.user_sessions (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  ip         text,
  user_agent text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

alter table public.user_sessions enable row level security;

-- =====================================================================
-- visitors — the IP log behind /sharmin. The simple, reliable design:
-- the browser gets its own public IP (from a free service) and writes it
-- straight here from the client (see src/data/sessionLog.ts); /sharmin
-- reads it straight back. No serverless functions involved (those kept
-- crashing on Vercel), no password for now (user's request), so anon can
-- insert/update/select. NOTE: because the client reports the IP, a
-- technical visitor could forge it — this is a casual "who visited"
-- view, not an anti-abuse control. (The older user_sessions table above
-- is unused now; you can ignore or drop it.)
-- =====================================================================
create table if not exists public.visitors (ip text primary key, user_agent text, name text, country text, country_code text, city text, flag text, isp text, visits integer not null default 1, first_seen timestamptz not null default now(), last_seen timestamptz not null default now());
alter table public.visitors add column if not exists country text;
alter table public.visitors add column if not exists country_code text;
alter table public.visitors add column if not exists city text;
alter table public.visitors add column if not exists flag text;
alter table public.visitors add column if not exists isp text;
alter table public.visitors enable row level security;
drop policy if exists "anyone can log a visit" on public.visitors;
create policy "anyone can log a visit" on public.visitors for insert with check (true);
drop policy if exists "anyone can update a visit" on public.visitors;
create policy "anyone can update a visit" on public.visitors for update using (true);
drop policy if exists "anyone can read visitors" on public.visitors;
create policy "anyone can read visitors" on public.visitors for select using (true);

-- NOTE: at the user's explicit request, /sharmin has no password for
-- now — this function does NOT check is_current_user_admin(), unlike
-- every other admin_* function above. That means ANYONE who can reach
-- your Supabase project's API (not just people using the app) can call
-- this and get every account's IP + device. Put the
-- "if not public.is_current_user_admin() then raise exception
-- 'not_authorized'; end if;" guard back (copy it from admin_list_users
-- above) and re-run this block, then change the grant below back to
-- `authenticated` only, once you're ready to lock it down again.
create or replace function public.admin_list_sessions()
returns table (
  user_id      uuid,
  email        text,
  username     text,
  display_name text,
  ip           text,
  user_agent   text,
  first_seen   timestamptz,
  last_seen    timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select s.user_id, u.email::text, p.username, p.display_name, s.ip, s.user_agent, s.first_seen, s.last_seen
    from public.user_sessions s
    join public.profiles p on p.id = s.user_id
    join auth.users u on u.id = s.user_id
    order by s.last_seen desc;
end;
$$;

grant execute on function public.admin_list_sessions() to authenticated, anon;

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

-- A comment can be deleted by its author OR by the owner of the photo/reel
-- it's on (so a creator can moderate comments on their own posts).
drop policy if exists "users can delete own comments" on public.comments;
drop policy if exists "author or reel owner can delete comments" on public.comments;
create policy "author or reel owner can delete comments"
  on public.comments for delete
  using (
    auth.uid() = user_id
    or auth.uid() = (select p.user_id from public.photos p where p.id = comments.photo_id)
  );

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

-- ---------- agency_applications (formulario del programa de agencias) ----------
create table if not exists public.agency_applications (id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null, agency_name text not null, contact_name text not null, email text not null, phone text, country text, creators text, message text, created_at timestamptz not null default now());
alter table public.agency_applications enable row level security;
drop policy if exists "anyone can apply to agency program" on public.agency_applications;
create policy "anyone can apply to agency program" on public.agency_applications for insert with check (true);
-- Solo los admin pueden leer las solicitudes (desde el panel, si lo agregas luego).
drop policy if exists "admins read agency applications" on public.agency_applications;
create policy "admins read agency applications" on public.agency_applications for select using (public.is_current_user_admin());

-- =====================================================================
-- STORAGE: avatars and PHOTOS are compressed on the client and stored
-- inline as data URLs, so no bucket is needed for those. VIDEOS are too
-- large for that, so they need a real Storage bucket:
--   Storage → New bucket → name: reels-videos → Public bucket: ON → Save.
-- No SQL policies needed for it — the app uploads with the logged-in
-- user's own session, and a public bucket allows anyone to read/play.
-- =====================================================================

-- ---------- moderación de lives (moderadores + expulsados) ----------
-- El anfitrión promueve moderadores con permisos granulares (silenciar /
-- expulsar). Los expulsados quedan en una lista de bloqueados por live que
-- les impide volver a entrar. El live_id sigue la convención de la app:
-- 'live_<user_id_del_anfitrión>', que es lo que valida la política del host.
create table if not exists public.live_moderators (
  live_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null,
  name text,
  avatar_url text,
  can_mute boolean not null default true,
  can_kick boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (live_id, user_id)
);
alter table public.live_moderators enable row level security;
drop policy if exists "anyone reads live moderators" on public.live_moderators;
create policy "anyone reads live moderators"
  on public.live_moderators for select using (true);
drop policy if exists "host manages live moderators" on public.live_moderators;
create policy "host manages live moderators"
  on public.live_moderators for all
  using (live_id = 'live_' || auth.uid()::text)
  with check (live_id = 'live_' || auth.uid()::text and auth.uid() = granted_by);

create table if not exists public.live_blocks (
  live_id text not null,
  user_id uuid not null,
  blocked_by uuid not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  primary key (live_id, user_id)
);
alter table public.live_blocks enable row level security;
drop policy if exists "anyone reads live blocks" on public.live_blocks;
create policy "anyone reads live blocks"
  on public.live_blocks for select using (true);
-- Puede bloquear el anfitrión del live o un moderador con permiso de expulsar.
drop policy if exists "host and kick-mods block users" on public.live_blocks;
create policy "host and kick-mods block users"
  on public.live_blocks for insert
  with check (
    auth.uid() = blocked_by
    and (
      live_id = 'live_' || auth.uid()::text
      or exists (
        select 1 from public.live_moderators m
        where m.live_id = live_blocks.live_id
          and m.user_id = auth.uid()
          and m.can_kick
      )
    )
  );
drop policy if exists "host and kick-mods unblock users" on public.live_blocks;
create policy "host and kick-mods unblock users"
  on public.live_blocks for delete
  using (
    live_id = 'live_' || auth.uid()::text
    or exists (
      select 1 from public.live_moderators m
      where m.live_id = live_blocks.live_id
        and m.user_id = auth.uid()
        and m.can_kick
    )
  );
