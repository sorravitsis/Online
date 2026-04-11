-- Store deduplication playbook
-- Use this in Supabase SQL Editor when store rows are duplicated.
-- This script is intentionally conservative:
-- 1. It detects duplicates by logical key: (platform, shop_id)
-- 2. It safely deletes only duplicate store rows that do NOT own any orders
-- 3. It shows unresolved duplicates that still need a manual merge decision

-- Inspect duplicate logical stores.
select
  platform,
  shop_id,
  count(*) as duplicate_count,
  string_agg(name, ' | ' order by created_at asc) as names,
  string_agg(id::text, ' | ' order by created_at asc) as store_ids
from stores
group by platform, shop_id
having count(*) > 1
order by platform, shop_id;

-- Inspect name collisions. These may be valid if shop_id differs.
select
  platform,
  name,
  count(*) as duplicate_name_count,
  string_agg(shop_id, ' | ' order by created_at asc) as shop_ids,
  string_agg(id::text, ' | ' order by created_at asc) as store_ids
from stores
group by platform, name
having count(*) > 1
order by platform, name;

-- Safe cleanup:
-- For exact duplicate logical stores, keep one canonical row and remove
-- only extra rows that have no orders linked to them.
with ranked_stores as (
  select
    id,
    platform,
    shop_id,
    name,
    created_at,
    row_number() over (
      partition by platform, shop_id
      order by
        is_active desc,
        (access_token is not null and refresh_token is not null) desc,
        token_expiry desc nulls last,
        created_at desc,
        id desc
    ) as row_rank
  from stores
),
unused_duplicates as (
  select ranked_stores.id
  from ranked_stores
  left join orders on orders.store_id = ranked_stores.id
  where ranked_stores.row_rank > 1
    and orders.id is null
)
delete from stores
where id in (select id from unused_duplicates);

-- Re-check duplicates after safe cleanup.
select
  platform,
  shop_id,
  count(*) as duplicate_count,
  string_agg(name, ' | ' order by created_at asc) as names,
  string_agg(id::text, ' | ' order by created_at asc) as store_ids
from stores
group by platform, shop_id
having count(*) > 1
order by platform, shop_id;

-- If duplicates still remain after the safe cleanup above,
-- they own orders and need a manual merge plan before deletion.
-- Once duplicates by (platform, shop_id) are gone, enforce this guard:
--
-- create unique index if not exists stores_platform_shop_id_key
--   on stores (platform, shop_id);
