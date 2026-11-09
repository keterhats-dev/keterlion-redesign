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
  assignee_id uuid references profiles, -- who is responsible; required, see orders_assign_guard below
  created_by uuid references profiles default auth.uid(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_status on orders (status);

-- Deals a person closes (quotes and sales), for the monthly sales summary
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  kind text not null default 'wholesale' check (kind in ('wholesale', 'lead')), -- regular customer or new lead
  items text,
  amount numeric(10, 2),
  status text not null default 'quote' check (status in ('quote', 'won', 'lost')),
  quote_date date not null default current_date,
  closed_date date,
  seller_id uuid not null default auth.uid() references profiles, -- only a manager records a deal for someone else
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deals_seller on deals (seller_id, closed_date);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch before update on tasks for each row execute function touch_updated_at();
drop trigger if exists orders_touch on orders;
create trigger orders_touch before update on orders for each row execute function touch_updated_at();
drop trigger if exists deals_touch on deals;
create trigger deals_touch before update on deals for each row execute function touch_updated_at();

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
-- Only a manager sees what is happening with everyone (4.11.2026). Anyone else sees the tasks
-- given to them or by them, and the orders they handle or opened. Anyone can give a task or
-- open an order for someone else.
create or replace function can_see_task(p_task uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tasks t where t.id = p_task and (is_owner() or t.assignee_id = auth.uid() or t.created_by = auth.uid()))
$$;
drop policy if exists team_all on tasks;
drop policy if exists tasks_read on tasks;
drop policy if exists tasks_add on tasks;
drop policy if exists tasks_change on tasks;
drop policy if exists tasks_remove on tasks;
create policy tasks_read on tasks for select using (is_team() and (is_owner() or assignee_id = auth.uid() or created_by = auth.uid()));
create policy tasks_add on tasks for insert with check (is_team());
create policy tasks_change on tasks for update using (is_team() and (is_owner() or assignee_id = auth.uid() or created_by = auth.uid())) with check (is_team());
create policy tasks_remove on tasks for delete using (is_team() and (is_owner() or assignee_id = auth.uid() or created_by = auth.uid()));
drop policy if exists team_all on checklist_items;
drop policy if exists task_people on checklist_items;
create policy task_people on checklist_items for all using (is_team() and can_see_task(task_id)) with check (is_team() and can_see_task(task_id));
drop policy if exists team_all on comments;
drop policy if exists task_people on comments;
create policy task_people on comments for all using (is_team() and can_see_task(task_id)) with check (is_team() and can_see_task(task_id));

-- Every order has someone responsible: whoever opened it, unless they picked someone.
-- Moving an order to someone else later is for a manager.
alter table orders alter column assignee_id set default auth.uid();
alter table orders alter column assignee_id set not null;
create or replace function orders_assign_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.assignee_id := coalesce(new.assignee_id, auth.uid());
    return new;
  end if;
  if not is_owner() then new.assignee_id := old.assignee_id; end if;
  return new;
end $$;
drop trigger if exists orders_assign_guard on orders;
create trigger orders_assign_guard before insert or update on orders for each row execute function orders_assign_guard();
-- Everyone else always records their own deals
create or replace function deals_seller_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_owner() then return new; end if;
  if tg_op = 'INSERT' then new.seller_id := auth.uid(); return new; end if;
  new.seller_id := old.seller_id;
  return new;
end $$;
drop trigger if exists deals_seller_guard on deals;
create trigger deals_seller_guard before insert or update on deals for each row execute function deals_seller_guard();
alter table deals enable row level security;
drop policy if exists team_all on deals;
drop policy if exists deals_own on deals;
create policy deals_own on deals for all using (is_team() and (is_owner() or seller_id = auth.uid())) with check (is_team());
alter table orders enable row level security;
drop policy if exists team_all on orders;
drop policy if exists orders_read on orders;
drop policy if exists orders_add on orders;
drop policy if exists orders_change on orders;
drop policy if exists orders_remove on orders;
create policy orders_read on orders for select using (is_team() and (is_owner() or assignee_id = auth.uid() or created_by = auth.uid()));
create policy orders_add on orders for insert with check (is_team());
create policy orders_change on orders for update using (is_team() and (is_owner() or assignee_id = auth.uid() or created_by = auth.uid())) with check (is_team());
create policy orders_remove on orders for delete using (is_team() and (is_owner() or assignee_id = auth.uid() or created_by = auth.uid()));

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

-- Google Calendar sync: each person gets a secret link (/cal/<token>) to a feed of their dated, open tasks.
-- Only they can read their token; the feed function asks calendar_feed() with the token alone.
create table if not exists calendar_feeds (
  user_id uuid primary key default auth.uid() references profiles on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table calendar_feeds enable row level security;
drop policy if exists own on calendar_feeds;
create policy own on calendar_feeds for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function my_calendar_token() returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if not is_team() then return null; end if;
  select token into t from calendar_feeds where user_id = auth.uid();
  if t is null then insert into calendar_feeds (user_id) values (auth.uid()) returning token into t; end if;
  return t;
end $$;
create or replace function calendar_feed(p_token uuid)
returns table (id uuid, title text, priority smallint, due_date date, due_time time, area text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.priority, t.due_date, t.due_time, a.name, t.updated_at
  from calendar_feeds f
  join profiles p on p.id = f.user_id and p.active
  join tasks t on t.assignee_id = f.user_id
  left join areas a on a.id = t.area_id
  where f.token = p_token and t.due_date is not null and t.status <> 'done' and t.due_date >= current_date - 30
$$;
revoke all on function calendar_feed(uuid) from public;
grant execute on function calendar_feed(uuid) to anon, authenticated;

-- Orders from the site (WooCommerce webhook → netlify/functions/woo-order.mjs → ingest_web_order)
alter table orders add column if not exists external_id text unique;   -- WooCommerce order id
alter table orders add column if not exists shipping text;
alter table orders add column if not exists is_custom boolean not null default false;  -- Zakeke design
alter table orders add column if not exists design_urls text[];

create table if not exists app_settings (key text primary key, value text);
alter table app_settings enable row level security; -- no policies: only server code reads it

-- Who handles orders from the site by default (Yona, the store worker)
insert into app_settings (key, value)
  select 'web_orders_assignee', id::text from profiles where name = 'יונה' and active
  on conflict (key) do update set value = excluded.value;

create or replace function ingest_web_order(p jsonb)
returns table (order_id uuid, assignee_id uuid, is_new boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare cur orders; who uuid; wstatus text := p->>'status';
begin
  select * into cur from orders o where o.external_id = p->>'external_id';
  if found then
    -- Known order: follow the site's status, keep everything people changed here
    update orders set
      status = case when wstatus = 'completed' then 'done'
                    when wstatus in ('cancelled', 'refunded', 'failed') then 'cancelled'
                    else orders.status end,
      closed_at = case when wstatus in ('completed', 'cancelled', 'refunded', 'failed') then coalesce(orders.closed_at, now()) else orders.closed_at end,
      design_urls = case when jsonb_array_length(coalesce(p->'design_urls', '[]'::jsonb)) > 0
                         then array(select jsonb_array_elements_text(p->'design_urls')) else orders.design_urls end
    where id = cur.id;
    return query select cur.id, cur.assignee_id, false;
    return;
  end if;
  -- New: only paid orders come in (not pending payment, not cancelled attempts)
  if wstatus not in ('processing', 'on-hold') then return; end if;
  select value::uuid into who from app_settings where key = 'web_orders_assignee';
  if who is null or not exists (select 1 from profiles where id = who and active) then
    select id into who from profiles where role = 'owner' and active order by created_at limit 1;
  end if;
  return query
  insert into orders (source, external_id, number, customer, items, amount, shipping, is_custom, design_urls, status, assignee_id, created_by)
  values ('site', p->>'external_id', p->>'number', coalesce(p->>'customer', 'לקוח מהאתר'), p->>'items', (p->>'amount')::numeric,
          p->>'shipping', coalesce((p->>'is_custom')::boolean, false),
          array(select jsonb_array_elements_text(coalesce(p->'design_urls', '[]'::jsonb))), 'new', who, null)
  returning orders.id, orders.assignee_id, true;
end $$;
revoke all on function ingest_web_order(jsonb) from public, anon, authenticated;
grant execute on function ingest_web_order(jsonb) to service_role;

-- Live updates on both phones
alter publication supabase_realtime add table tasks, checklist_items, comments, profiles, team_invites, orders, deals;

-- The first manager. Put your own email and name, run, then log in from the app:
-- insert into team_invites (email, name, role, title) values ('you@example.com', 'השם שלך', 'owner', 'בעלים');
