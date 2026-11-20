-- Optional Mecha Sonic device backups. Apply only to the intended Supabase project.
-- Snapshots are account-scoped and per-device; this is not cross-device merging.
create table if not exists public.mechasonic_backup_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  entity text not null check (entity in ('scan', 'asset', 'estimate')),
  local_id bigint not null check (local_id > 0),
  sequence bigint not null check (sequence > 0),
  payload jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id, entity, local_id)
);
alter table public.mechasonic_backup_records enable row level security;
revoke all on public.mechasonic_backup_records from anon;
grant select, insert, update on public.mechasonic_backup_records to authenticated;
create policy "mechasonic_select_own" on public.mechasonic_backup_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "mechasonic_insert_own" on public.mechasonic_backup_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mechasonic_update_own" on public.mechasonic_backup_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Sequence is the IndexedDB mutation ID. The conditional upsert makes retries
-- idempotent and prevents late requests from resurrecting older device state.
create or replace function public.mechasonic_apply_change(
  p_device_id uuid, p_entity text, p_local_id bigint, p_sequence bigint,
  p_payload jsonb, p_deleted boolean
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_device_id is null or p_local_id <= 0 or p_sequence <= 0 or p_entity not in ('scan','asset','estimate') then
    raise exception 'Invalid backup mutation';
  end if;
  insert into public.mechasonic_backup_records as current_record(user_id,device_id,entity,local_id,sequence,payload,deleted)
  values(auth.uid(),p_device_id,p_entity,p_local_id,p_sequence,case when p_deleted then null else p_payload end,p_deleted)
  on conflict(user_id,device_id,entity,local_id) do update
    set sequence=excluded.sequence,payload=excluded.payload,deleted=excluded.deleted,updated_at=now()
    where current_record.sequence < excluded.sequence;
end;
$$;
revoke all on function public.mechasonic_apply_change(uuid,text,bigint,bigint,jsonb,boolean) from public, anon;
grant execute on function public.mechasonic_apply_change(uuid,text,bigint,bigint,jsonb,boolean) to authenticated;
