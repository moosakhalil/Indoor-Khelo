-- Phase 5 database setup: the scoring log and the scoring lock. Apply to Neon project "Indoor Khelo", branch main.

-- Every action while scoring is one row. The match is worked out from these rows (see src/lib/engine).
-- Rows are never changed or deleted: an undo is another row that cancels the latest one, and an edit is another row.
create table match_event (
  id uuid primary key,                       -- made on the phone, so a repeated send is ignored
  match_id uuid not null references cricket_match(id) on delete cascade,
  seq int not null check (seq >= 1),         -- 1, 2, 3 ... with no gaps
  type text not null,
  payload jsonb not null,
  reason text check (reason is null or char_length(reason) <= 200),
  actor_id uuid not null,
  actor_name text not null,
  device_id text not null,
  client_at timestamptz,
  created_at timestamptz not null default now(),
  unique (match_id, seq)
);
create index match_event_actor_idx on match_event (match_id, actor_id);

-- The scoring lock: one member, on one device, at a time. A takeover request waits for the scorer to accept.
alter table cricket_match
  add column scorer_id uuid,
  add column scorer_device text,
  add column scorer_since timestamptz,
  add column takeover_by uuid,
  add column takeover_at timestamptz,
  add column started_at timestamptz,
  add column finished_at timestamptz,
  add column result jsonb;

-- The log can only be appended to, never edited or removed one row at a time.
create function match_event_append_only() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'match_event_is_append_only' using errcode = 'P0001';
  end if;
  -- deleting the whole match (or community) is fine; deleting a single row on its own is not
  if tg_op = 'DELETE' and exists (select 1 from cricket_match m where m.id = old.match_id) then
    raise exception 'match_event_is_append_only' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger match_event_no_update before update on match_event for each row execute function match_event_append_only();
create trigger match_event_no_delete before delete on match_event for each row execute function match_event_append_only();
