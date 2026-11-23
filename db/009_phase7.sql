-- Phase 7 database setup: venues, bookings, cost sharing, contributions (payments and refunds), history.
-- Apply to Neon project "Indoor Khelo", branch main.
-- Money rules: paying is a convenience, never a rule. A booking has a total cost; members record who paid how much;
-- the equal split is only a suggestion. Nothing here can change a score or a statistic.

create table venue (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  address text not null default '' check (char_length(address) <= 120),
  contact text not null default '' check (char_length(contact) <= 60),
  created_by uuid not null,
  changed_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index venue_name_unique on venue (community_id, lower(btrim(name)));

create table booking (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(id) on delete cascade,
  venue_id uuid not null references venue(id),
  starts_at timestamptz not null,
  duration_minutes int not null check (duration_minutes between 15 and 720),
  total_cost int not null check (total_cost between 0 and 10000000),        -- whole rupees
  reference text not null default '' check (char_length(reference) <= 40),
  notes text not null default '' check (char_length(notes) <= 300),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  last_reminder_at timestamptz,
  created_by uuid not null,
  changed_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_community_idx on booking (community_id, starts_at desc);

create table booking_match (
  booking_id uuid not null references booking(id) on delete cascade,
  match_id uuid not null references cricket_match(id) on delete cascade,
  primary key (booking_id, match_id)
);

-- Who the cost is suggested to be shared between: members, or guests typed by name.
create table booking_member (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references booking(id) on delete cascade,
  user_id uuid,
  guest_name text check (guest_name is null or char_length(btrim(guest_name)) between 1 and 60),
  added_by uuid not null,
  added_at timestamptz not null default now(),
  check (user_id is not null or guest_name is not null)
);
create unique index booking_member_user_once on booking_member (booking_id, user_id) where user_id is not null;
create unique index booking_member_guest_once on booking_member (booking_id, lower(btrim(guest_name))) where guest_name is not null;

-- Contributions: any amount, from anyone. A refund is a negative contribution recorded by hand.
create table booking_payment (
  id uuid primary key,                                   -- made on the phone, so an offline record can be sent twice safely
  booking_id uuid not null references booking(id) on delete cascade,
  payer_user_id uuid,
  payer_name text not null check (char_length(btrim(payer_name)) between 1 and 60),
  kind text not null default 'payment' check (kind in ('payment', 'refund')),
  amount int not null check (amount between 1 and 10000000),
  paid_on date not null,
  method text not null check (method in ('cash', 'bank_transfer', 'jazzcash', 'easypaisa', 'card', 'other')),
  reference text not null default '' check (char_length(reference) <= 60),
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid not null,
  changed_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_payment_booking_idx on booking_payment (booking_id, paid_on);

create table booking_history (
  id bigserial primary key,
  booking_id uuid not null references booking(id) on delete cascade,
  actor_id uuid not null,
  actor_name text not null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index booking_history_idx on booking_history (booking_id, id desc);

-- Alerts can now point at a booking too (your share, a payment reminder, a changed amount).
alter table app_alert drop constraint app_alert_kind_check;
alter table app_alert add constraint app_alert_kind_check check (kind in
  ('match_scheduled','match_reminder','match_changed','match_postponed','match_cancelled','booking_share','payment_reminder','booking_changed'));
alter table app_alert add column booking_id uuid references booking(id) on delete cascade;
