-- A finished match can have a public, read-only link (an unguessable code) that opens without signing in.
-- Any member can switch it on or off. Nothing else about the community is reachable from it.
alter table cricket_match add column share_token text unique;
