-- Phase 6 database setup: per-player figures for every finished match. Apply to Neon project "Indoor Khelo", branch main.
-- These rows are NEVER typed in. They are worked out from the ball-by-ball log (match_event) when a match is finished,
-- and worked out again after every correction, so a player's stats always agree with the deliveries.

alter table cricket_match add column scores jsonb;   -- [{ innings, batting, runs, wickets, balls, superOver }] for team records

create table match_stat (
  match_id uuid not null references cricket_match(id) on delete cascade,
  entry_id uuid not null,                              -- match_player.id (the person's place in this match)
  side int not null check (side in (1, 2)),
  name text not null,                                  -- as on the scorecard that day
  number_used int,                                     -- the player number used in this match
  result text not null check (result in ('win', 'loss', 'tie', 'none')),
  points int not null default 0,                       -- Player of the Match points
  pom boolean not null default false,
  data jsonb not null,                                 -- batting, bowling, fielding, partnerships
  primary key (match_id, entry_id)
);
create index match_stat_entry_idx on match_stat (entry_id);
