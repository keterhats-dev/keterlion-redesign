-- Keterlion ops app: tables and access rules.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Login is by email code. Only invited people get in: a manager adds them to team_invites
-- from the app, and on their first login claim_invite() turns the invite into a profile.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')), -- owner = manager
  title text,
  email text,
  active boolean not null default true, -- false = removed from the team, keeps their history
  created_at timestamptz not null default now()
);

create table if not exists team_invites (
  email text primary key, -- lower case
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  title text,
  invited_by uuid references profiles default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists areas (
  id text primary key,
  name text not null,
  sort int not null default 0
);

insert into areas (id, name, sort) values
  ('accounting', 'הנהלת חשבונות', 1),
  ('tech', 'טכני ומערכת', 2),
  ('stock', 'מלאי בחנות', 3),
  ('wholesale', 'סיטונאות', 4),
  ('web-orders', 'הזמנות באתר', 5),
  ('wolt', 'Wolt', 6),
  ('leads', 'לידים והצעות מחיר', 7),
  ('general', 'כללי', 8)
on conflict (id) do nothing;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  area_id text references areas,
  assignee_id uuid references profiles,
  created_by uuid references profiles default auth.uid(),
  priority smallint not null default 3 check (priority in (1, 2, 3)), -- 1 urgent, 2 important, 3 normal
  status text not null default 'open' check (status in ('open', 'doing', 'waiting', 'done')),
  due_date date,
  due_time time,
  done_at timestamptz,
  calendar_event_id text,
  acknowledged_at timestamptz, -- when the assignee tapped "קיבלתי"; set at once for tasks you give yourself
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_assignee_status on tasks (assignee_id, status);

create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks on delete cascade,
  text text not null,
  done boolean not null default false,
  sort int not null default 0
);

-- kind 'comment' is a message; kind 'event' is a line like "ארי שינה את הסטטוס"
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks on delete cascade,
  author_id uuid references profiles default auth.uid(),
  kind text not null default 'comment' check (kind in ('comment', 'event')),
  body text not null,
  created_at timestamptz not null default now()
);

-- Open orders, added by hand for now (later: pulled from WooCommerce)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'site' check (source in ('site', 'wholesale', 'wolt', 'store', 'other')),
  number text,
  customer text not null,
  items text,
  amount numeric(10, 2),
  status text not null default 'new' check (status in ('new', 'preparing', 'ready', 'done', 'cancelled')),
  due_date date,
  notes text,
  created_by uuid references profiles default auth.uid(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_status on orders (status);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch before update on tasks for each row execute function touch_updated_at();
drop trigger if exists orders_touch on orders;
create trigger orders_touch before update on orders for each row execute function touch_updated_at();

-- Access: everyone on the team (active profile) sees and edits all tasks. Small team, one board.
-- Only managers add, change or remove team members.
create or replace function is_team() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;
create or replace function is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'owner')
$$;

-- Called by the app after login: returns my profile, creating it from my invite on first login
create or replace function claim_invite() returns profiles language plpgsql security definer set search_path = public as $$
declare inv team_invites; p profiles;
begin
  select * into p from profiles where id = auth.uid();
  if found then return p; end if;
  select * into inv from team_invites where email = lower(auth.jwt() ->> 'email');
  if not found then return null; end if;
  -- two parallel calls at login must not fail on the second insert
  insert into profiles (id, name, role, title, email) values (auth.uid(), inv.name, inv.role, inv.title, inv.email)
    on conflict (id) do nothing;
  delete from team_invites where email = inv.email;
  select * into p from profiles where id = auth.uid();
  return p;
end $$;

alter table team_invites enable row level security;
drop policy if exists owner_all on team_invites;
create policy owner_all on team_invites for all using (is_owner()) with check (is_owner());

alter table profiles enable row level security;
drop policy if exists owner_update on profiles;
create policy owner_update on profiles for update using (is_owner()) with check (is_owner());
alter table areas enable row level security;
alter table tasks enable row level security;
alter table checklist_items enable row level security;
alter table comments enable row level security;

drop policy if exists team_read on profiles;
create policy team_read on profiles for select using (is_team());
drop policy if exists team_read on areas;
create policy team_read on areas for select using (is_team());
drop policy if exists team_all on tasks;
create policy team_all on tasks for all using (is_team()) with check (is_team());
drop policy if exists team_all on checklist_items;
create policy team_all on checklist_items for all using (is_team()) with check (is_team());
drop policy if exists team_all on comments;
create policy team_all on comments for all using (is_team()) with check (is_team());
alter table orders enable row level security;
drop policy if exists team_all on orders;
create policy team_all on orders for all using (is_team()) with check (is_team());

-- Phone notifications (Web Push). Each person sees only their own devices;
-- the notify function reads the assignee's devices through push_targets().
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists own_all on push_subscriptions;
create policy own_all on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid() and is_team());
create or replace function push_targets(p_user uuid) returns setof push_subscriptions language sql stable security definer set search_path = public as $$
  select * from push_subscriptions where user_id = p_user and is_team()
$$;
-- Who has notifications on (ids only), so a manager can see it on the team screen
create or replace function push_status() returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct user_id from push_subscriptions where is_team()
$$;
create or replace function remove_push(p_endpoint text) returns void language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and is_team()
$$;

-- Live updates on both phones
alter publication supabase_realtime add table tasks, checklist_items, comments, profiles, team_invites, orders;

-- The first manager. Put your own email and name, run, then log in from the app:
-- insert into team_invites (email, name, role, title) values ('you@example.com', 'השם שלך', 'owner', 'בעלים');
