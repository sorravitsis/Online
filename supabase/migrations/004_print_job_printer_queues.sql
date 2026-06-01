-- 004_print_job_printer_queues.sql
-- Route local print jobs to a named printer queue so multiple warehouse PCs can
-- share work, while different printer groups do not steal each other's jobs.

alter table print_jobs
  add column if not exists printer_queue text;

create index if not exists print_jobs_queue_status_created_idx
  on print_jobs (printer_queue, status, created_at asc);

create or replace function claim_next_print_job(
  p_agent_name text,
  p_printer_name text default null,
  p_printer_queue text default null
)
returns setof print_jobs
language plpgsql
security definer
as $$
begin
  return query
  with next_job as (
    select id
    from print_jobs
    where
      status = 'queued'
      and (
        p_printer_queue is null
        or printer_queue is null
        or printer_queue = p_printer_queue
      )
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
