-- 002_print_jobs_queue.sql
-- Local print queue for USB / driver-based printers

create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  batch_id uuid,
  awb_number text,
  mode text not null check (mode in ('1to1', 'batch')),
  batch_size integer,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'printed', 'failed')),
  document_type text not null
    check (document_type in ('pdf', 'zpl')),
  document_payload_base64 text not null,
  error_msg text,
  printed_by text,
  printer_name text,
  claimed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists print_jobs_status_created_idx
  on print_jobs (status, created_at asc);

create index if not exists print_jobs_order_id_idx
  on print_jobs (order_id);

create unique index if not exists print_jobs_one_active_per_order_idx
  on print_jobs (order_id)
  where status in ('queued', 'processing');

create or replace function claim_next_print_job(p_agent_name text, p_printer_name text default null)
returns setof print_jobs
language plpgsql
security definer
as $$
begin
  return query
  with next_job as (
    select id
    from print_jobs
    where status = 'queued'
    order by created_at asc
    limit 1
    for update skip locked
  )
  update print_jobs jobs
  set
    status = 'processing',
    claimed_by = p_agent_name,
    printer_name = coalesce(p_printer_name, jobs.printer_name),
    updated_at = now()
  from next_job
  where jobs.id = next_job.id
  returning jobs.*;
end;
$$;

create or replace function finish_print_job(
  p_job_id uuid,
  p_success boolean,
  p_error_msg text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_job print_jobs%rowtype;
begin
  select *
  into v_job
  from print_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'print_job_not_found';
  end if;

  update print_jobs
  set
    status = case when p_success then 'printed' else 'failed' end,
    error_msg = case when p_success then null else p_error_msg end,
    processed_at = now(),
    updated_at = now()
  where id = p_job_id;

  if p_success then
    update orders
    set
      awb_status = 'printed',
      awb_number = v_job.awb_number,
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
      v_job.awb_number,
      v_job.mode,
      v_job.batch_size,
      'printed',
      null,
      v_job.printed_by
    );
  else
    update orders
    set awb_status = 'failed'
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
      v_job.awb_number,
      v_job.mode,
      v_job.batch_size,
      'failed',
      p_error_msg,
      v_job.printed_by
    );
  end if;
end;
$$;
