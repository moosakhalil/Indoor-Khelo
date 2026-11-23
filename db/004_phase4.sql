-- Phase 4 database setup: matches, sides, lineups, guests, availability replies, in-app alerts.
-- Apply to Neon project "Indoor Khelo", branch main.

create table cricket_match (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(id) on delete cascade,
  status text not null default 'scheduled'
    check (status in ('draft','scheduled','live','paused','completed','postponed','cancelled','abandoned')),
  scheduled_at timestamptz,                      -- empty = draft (no date yet), or postponed with no new date
  venue text not null default '' check (char_length(venue) <= 80),
  overs int not null check (overs between 1 and 50),
  players_per_side int not null check (players_per_side between 2 and 11),
  rules jsonb not null,                          -- the rules snapshot for THIS match (changing defaults later never touches it)
  umpire text not null default '' check (char_length(umpire) <= 40),   -- a label only, no extra powers
  notes text not null default '' check (char_length(notes) <= 300),
  toss_winner_side int check (toss_winner_side in (1, 2)),
  toss_decision text check (toss_decision in ('bat', 'bowl')),
  batting_first_side int check (batting_first_side in (1, 2)),
  rematch_of uuid references cricket_match(id) on delete set null,
  last_reminder_at timestamptz,
  created_by uuid not null,                      -- "Created by"
  changed_by uuid not null,                      -- "Changed by"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((toss_winner_side is null) = (toss_decision is null)),
  check (status <> 'scheduled' or scheduled_at is not null)
);
create index cricket_match_community_idx on cricket_match (community_id, status, scheduled_at);

-- Two sides per match. A side is a permanent team or a temporary match-only team (team_id empty).
-- The name is kept as it was on the day, so renaming a team later does not rewrite old scorecards.
create table match_side (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references cricket_match(id) on delete cascade,
  position int not null check (position in (1, 2)),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  team_id uuid references team(id) deferrable initially deferred,   -- a team that has matches cannot be deleted (checked by the app too)
  unique (match_id, position),
  unique (id, match_id)
);
create unique index match_side_team_once on match_side (match_id, team_id) where team_id is not null;
create index match_side_team_idx on match_side (team_id);

create function enforce_distinct_side_names() returns trigger language plpgsql as $$
begin
  if exists (select 1 from match_side s where s.match_id = new.match_id and s.id <> new.id
              and lower(btrim(s.name)) = lower(btrim(new.name))) then
    raise exception 'same_side_name' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger match_side_names before insert or update of name on match_side
  for each row execute function enforce_distinct_side_names();

-- The lineup of one match. A member (user_id), a guest (guest_name only), or a guest linked later to a member (both).
create table match_player (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  side_id uuid not null,
  user_id uuid,
  guest_name text check (guest_name is null or char_length(btrim(guest_name)) between 1 and 60),
  linked_by uuid,
  linked_at timestamptz,
  added_by uuid not null,
  added_at timestamptz not null default now(),
  foreign key (side_id, match_id) references match_side(id, match_id) on delete cascade,
  check (user_id is not null or guest_name is not null),
  check (linked_by is null or (user_id is not null and guest_name is not null))
);
create unique index match_player_member_once on match_player (match_id, user_id) where user_id is not null;
create unique index match_player_guest_once on match_player (match_id, lower(btrim(guest_name))) where guest_name is not null;
create index match_player_user_idx on match_player (user_id);

-- Only approved members of the match's community can be in a lineup as a member.
create function enforce_lineup_member() returns trigger language plpgsql as $$
begin
  if new.user_id is not null and not exists (
       select 1 from cricket_match m join community_member cm on cm.community_id = m.community_id
        where m.id = new.match_id and cm.user_id = new.user_id and cm.status = 'approved') then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger match_player_member before insert or update of user_id on match_player
  for each row execute function enforce_lineup_member();

-- "Are you coming?" replies. Guidance only, never a rule.
create table match_availability (
  match_id uuid not null references cricket_match(id) on delete cascade,
  user_id uuid not null,
  answer text not null check (answer in ('in', 'out')),
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index match_availability_user_idx on match_availability (user_id);

-- In-app alerts (match scheduled, reminders, postponed, cancelled, moved). Push notifications are a separate open decision.
create table app_alert (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(id) on delete cascade,
  user_id uuid not null,
  match_id uuid references cricket_match(id) on delete cascade,
  kind text not null check (kind in ('match_scheduled','match_reminder','match_changed','match_postponed','match_cancelled')),
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index app_alert_user_idx on app_alert (user_id, community_id, created_at desc);
