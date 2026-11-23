-- Phase 3 database setup (already applied to Neon project "Indoor Khelo", branch main).
-- Player profile fields live on app_user because a person has ONE profile across all communities.

alter table app_user
  add column batting_hand text check (batting_hand in ('right','left')),
  add column batting_position text check (batting_position in ('opener','top_order','middle_order','finisher')),
  add column bowling_style text check (bowling_style in ('right_fast','right_medium','right_spin','left_fast','left_medium','left_spin','none')),
  add column playing_role text check (playing_role in ('batter','bowler','all_rounder','wicket_keeper')),
  add column profile_visibility text not null default 'community' check (profile_visibility in ('private','community','link'));

create table team (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  description text not null default '' check (char_length(description) <= 200),
  captain_id uuid,
  vice_captain_id uuid,
  created_by uuid not null,            -- "Added by"
  changed_by uuid not null,            -- "Changed by"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (captain_id is null or vice_captain_id is null or captain_id <> vice_captain_id)
);
create unique index team_name_unique on team (community_id, lower(btrim(name)));

-- The permanent squad. Each match picks its own lineup separately (Phase 4).
create table team_player (
  team_id uuid not null references team(id) on delete cascade,
  user_id uuid not null,
  added_by uuid not null,
  added_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_player_user_idx on team_player (user_id);

-- Only approved members of the team's community can be in its squad.
create function enforce_squad_member() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from team t join community_member m on m.community_id = t.community_id
                  where t.id = new.team_id and m.user_id = new.user_id and m.status = 'approved') then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger team_player_member before insert on team_player
  for each row execute function enforce_squad_member();
