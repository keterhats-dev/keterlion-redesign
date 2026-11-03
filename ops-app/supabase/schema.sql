-- Keterlion ops app: tables and access rules.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Login is by email code only, and only for people who have a row in profiles (invite only).

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  title text,
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

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch before update on tasks for each row execute function touch_updated_at();

-- Access: everyone on the team (has a profile) sees and edits everything. Small team, one board.
create or replace function is_team() returns boolean language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid())
$$;

alter table profiles enable row level security;
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

-- Live updates on both phones
alter publication supabase_realtime add table tasks, checklist_items, comments;
