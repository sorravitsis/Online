-- 005_seller_center_automation_queue.sql
-- Queue Shopee orders that must be printed through Seller Center browser automation.

create table if not exists seller_center_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  store_id uuid not null references stores(id),
  platform_order_id text not null,
  batch_id uuid,
  mode text not null check (mode in ('1to1', 'batch')),
  batch_size integer,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'printed', 'failed', 'login_required')),
  error_msg text,
  requested_by text,
  claimed_by text,
  browser_profile text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_claimed_at timestamptz,
  processed_at timestamptz,

  unique (order_id)
);

create index if not exists seller_center_jobs_status_created_idx
  on seller_center_jobs (status, created_at asc);

create index if not exists seller_center_jobs_store_status_created_idx
  on seller_center_jobs (store_id, status, created_at asc);

create or replace function claim_next_seller_center_job(
  p_agent_name text,
  p_store_id uuid,
  p_browser_profile text default null
)
returns setof seller_center_jobs
language plpgsql
security definer
as $$
begin
  update seller_center_jobs
  set
    status = 'queued',
    error_msg = 'automation_claim_expired',
    updated_at = now()
  where
    status = 'processing'
    and last_claimed_at < now() - interval '10 minutes';

  return query
  with next_job as (
    select id
    from seller_center_jobs
    where
      status = 'queued'
      and store_id = p_store_id
    order by created_at asc
    limit 1
    for update skip locked
  )
  update seller_center_jobs jobs
  set
    status = 'processing',
    claimed_by = p_agent_name,
    browser_profile = coalesce(p_browser_profile, jobs.browser_profile),
    attempt_count = jobs.attempt_count + 1,
    last_claimed_at = now(),
    updated_at = now()
  from next_job
  where jobs.id = next_job.id
  returning jobs.*;
end;
$$;

create or replace function finish_seller_center_job(
  p_job_id uuid,
  p_success boolean,
  p_error_msg text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_job seller_center_jobs%rowtype;
  v_is_login_required boolean;
begin
  select *
  into v_job
  from seller_center_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'seller_center_job_not_found';
  end if;

  v_is_login_required := coalesce(p_error_msg, '') ilike '%seller_center_login_required%';

  update seller_center_jobs
  set
    status = case
      when p_success then 'printed'
      when v_is_login_required then 'login_required'
      else 'failed'
    end,
    error_msg = case when p_success then null else p_error_msg end,
    processed_at = now(),
    updated_at = now()
  where id = p_job_id;

  if p_success then
    update orders
    set
      awb_status = 'printed',
      printed_at = now()
    where id = v_job.order_id;

    insert into print_log (
      order_id,
      batch_id,
      awb_number,
      mode,
      batch_size,
      status,
      error_msg,
      printed_by
    ) values (
      v_job.order_id,
      v_job.batch_id,
      null,
      v_job.mode,
      v_job.batch_size,
      'printed',
      null,
      coalesce(v_job.claimed_by, v_job.requested_by)
    );
  else
    update orders
    set awb_status = case when v_is_login_required then 'pending' else 'failed' end
    where id = v_job.order_id;

    insert into print_log (
      order_id,
      batch_id,
      awb_number,
      mode,
      batch_size,
      status,
      error_msg,
      printed_by
    ) values (
      v_job.order_id,
      v_job.batch_id,
      null,
      v_job.mode,
      v_job.batch_size,
      'failed',
      p_error_msg,
      coalesce(v_job.claimed_by, v_job.requested_by)
    );
  end if;
end;
$$;
