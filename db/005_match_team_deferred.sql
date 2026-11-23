-- Fix found by the Phase 4 tests: deleting a whole community failed when one of its matches used a permanent team,
-- because the team was removed before the match. The check now happens at the end of the transaction instead.
-- (Deleting a single team that has matches is still refused by the app with a clear message.)
alter table match_side alter constraint match_side_team_id_fkey deferrable initially deferred;
