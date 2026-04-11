-- 003_platform_status_cleanup.sql
-- Track platform shipping lifecycle separately from local AWB print state.

alter table orders
  add column if not exists platform_status text;

alter table orders
  alter column platform_status set default 'unknown';

update orders
set platform_status = 'unknown'
where platform_status is null;

alter table orders
  alter column platform_status set not null;

create index if not exists orders_platform_status_idx
  on orders (platform_status)
  where platform_status is not null;
