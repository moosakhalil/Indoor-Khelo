-- Phase 1 database setup (already applied to Neon project "Indoor Khelo", branch main).
-- Kept here as a record. Neon Auth keeps its own users in the neon_auth schema.

create table app_user (
  id uuid primary key,                       -- same id as the Neon Auth user
  name text not null check (char_length(btrim(name)) between 1 and 60),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table community (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  location text not null default '' check (char_length(location) <= 80),
  approval_required boolean not null default true,
  invite_code text not null unique check (invite_code ~ '^KH-[A-Z0-9]{4,8}$'),
  created_by uuid not null,                  -- "Added by"
  changed_by uuid not null,                  -- "Changed by"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table community_member (
  community_id uuid not null references community(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin','member')),
  status text not null check (status in ('pending','approved','rejected','removed','left')),
  player_number smallint check (player_number between 1 and 99),   -- 1 to 99 only
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  left_at timestamptz,
  primary key (community_id, user_id),
  check (status = 'approved' or player_number is null)             -- only approved members hold a number
);

-- One owner per number inside a community: first come, first served.
create unique index community_member_number_unique
  on community_member (community_id, player_number)
  where status = 'approved' and player_number is not null;
create index community_member_user_idx on community_member (user_id);

create table audit_log (
  id bigserial primary key,
  community_id uuid references community(id) on delete cascade,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_community_idx on audit_log (community_id, created_at desc);

-- A community holds at most 99 approved members (numbers are 1 to 99).
create function enforce_community_cap() returns trigger language plpgsql as $$
begin
  if new.status = 'approved' then
    perform pg_advisory_xact_lock(hashtext(new.community_id::text));
    if (select count(*) from community_member
         where community_id = new.community_id and status = 'approved' and user_id <> new.user_id) >= 99 then
      raise exception 'community_full' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger community_member_cap before insert or update on community_member
  for each row execute function enforce_community_cap();
