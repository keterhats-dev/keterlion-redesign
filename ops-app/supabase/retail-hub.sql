-- Runs in the RETAIL HUB database (Lovable project "Keterlion Retail Hub", fzovcxvkmnqslyztjqxg),
-- not in the ops app. Lets the ops app's "חסר בחנות" read stock and open transfer drafts,
-- through netlify/functions/stock.mjs only.
--
-- Protection: both functions need p_key. The first call with a key of 24+ characters links it
-- (only its SHA-256 is kept in ops_link); after that any other key is refused.
-- The key lives in the ops app's database (app_settings.retail_hub_key). To change it: give it a new
-- value there, then here: delete from ops_link; the next call links the new key.
-- Nothing here changes stock: a draft transfer only waits in "העברות בין סניפים" until someone sends it.

create table if not exists public.ops_link (
  id int primary key default 1 check (id = 1),
  key_hash text not null,
  linked_at timestamptz not null default now()
);
alter table public.ops_link enable row level security; -- no policies: only the functions below read it

create or replace function public.ops_check(p_key text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text; s text;
begin
  if p_key is null or length(p_key) < 24 then return false; end if;
  h := encode(extensions.digest(p_key, 'sha256'), 'hex');
  select key_hash into s from ops_link where id = 1;
  if s is null then insert into ops_link (id, key_hash) values (1, h); return true; end if;
  return s = h;
end $$;
revoke all on function public.ops_check(text) from public, anon, authenticated;

-- Models → colours → sizes, with stock in the store (MAIN) and the warehouse (WH). No costs or prices.
create or replace function public.ops_stock(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare wh uuid := (select id from branches where code = 'WH');
        st uuid := (select id from branches where code = 'MAIN');
begin
  if not ops_check(p_key) then raise exception 'unauthorized' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name_he, 'image', p.image_url, 'colors', pc.colors) order by p.name_he)
    from products p
    cross join lateral (
      select jsonb_agg(jsonb_build_object('id', coalesce(c.id::text, 'none'), 'name', coalesce(c.name, '—'), 'hex', c.hex, 'variants', cv.vs) order by c.name) as colors
      from (select distinct v.color_id from variants v where v.product_id = p.id and v.is_active) vc
      left join colors c on c.id = vc.color_id
      cross join lateral (
        select jsonb_agg(jsonb_build_object(
          'id', v.id, 'size', coalesce(s.name, 'OS'),
          'store', coalesce((select sl.qty from stock_levels sl where sl.variant_id = v.id and sl.branch_id = st), 0),
          'warehouse', coalesce((select sl.qty from stock_levels sl where sl.variant_id = v.id and sl.branch_id = wh), 0)
        ) order by s.sort_order nulls first, s.name) as vs
        from variants v left join sizes s on s.id = v.size_id
        where v.product_id = p.id and v.is_active and v.color_id is not distinct from vc.color_id
      ) cv
    ) pc
    where p.is_active and pc.colors is not null
  ), '[]'::jsonb);
end $$;
revoke all on function public.ops_stock(text) from public, authenticated;
grant execute on function public.ops_stock(text) to anon;

-- A draft transfer warehouse → store with the requested lines
create or replace function public.ops_request_transfer(p_key text, p_lines jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare wh uuid := (select id from branches where code = 'WH');
        st uuid := (select id from branches where code = 'MAIN');
        tid uuid;
begin
  if not ops_check(p_key) then raise exception 'unauthorized' using errcode = '42501'; end if;
  insert into transfers (from_branch_id, to_branch_id, status, note) values (wh, st, 'draft', left(p_note, 500)) returning id into tid;
  insert into transfer_lines (transfer_id, variant_id, qty)
    select tid, v.id, least(999, greatest(1, (l->>'qty')::int))
    from jsonb_array_elements(p_lines) l join variants v on v.id = (l->>'variant_id')::uuid;
  return jsonb_build_object('id', tid);
end $$;
revoke all on function public.ops_request_transfer(text, jsonb, text) from public, authenticated;
grant execute on function public.ops_request_transfer(text, jsonb, text) to anon;
