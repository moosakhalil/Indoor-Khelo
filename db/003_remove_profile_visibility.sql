-- Applied to Neon project "Indoor Khelo", branch main.
-- Decision: everyone in a community can see every player's profile and stats, so there is no privacy setting.
alter table app_user drop column profile_visibility;
