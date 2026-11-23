-- Phase 8: series and tournaments (optional groupings of matches). Apply to Neon project "Indoor Khelo", branch main.
-- A series is never needed to make a match. A match belongs to at most one series. Being in a series changes nothing about stats.
-- A drawn series stays drawn: there is no tie-break and no manual winner.

create table series (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  format text not null default 'open' check (format in ('open', 'best_of')),
  best_of int check (best_of between 1 and 21),
  starts_on date,
  ends_on date,
  notes text not null default '' check (char_length(notes) <= 300),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null,                  -- "Added by"
  changed_by uuid not null,                  -- "Changed by"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((format = 'best_of') = (best_of is not null)),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create unique index series_name_unique on series (community_id, lower(btrim(name)));

-- The teams taking part: a permanent team or a match-only name.
create table series_side (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references series(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  team_id uuid references team(id) deferrable initially deferred   -- checked at the end of the transaction, so deleting a whole community works
);
create unique index series_side_name_unique on series_side (series_id, lower(btrim(name)));
create unique index series_side_team_once on series_side (series_id, team_id) where team_id is not null;
create index series_side_team_idx on series_side (team_id);

-- One match can be in one series only. Removing a match from a series keeps the match.
create table series_match (
  match_id uuid primary key references cricket_match(id) on delete cascade,
  series_id uuid not null references series(id) on delete cascade,
  added_by uuid not null,
  added_at timestamptz not null default now()
);
create index series_match_series_idx on series_match (series_id);
