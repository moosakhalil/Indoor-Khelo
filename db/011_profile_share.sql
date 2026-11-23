-- A player can switch on a public, read-only link to their own profile and career totals.
-- It is OFF by default (empty), only that player can switch it on or off, and a new code is made each time it is switched on.
alter table app_user add column profile_share_token text unique;
