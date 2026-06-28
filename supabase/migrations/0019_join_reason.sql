-- 0019_join_reason.sql — optional reason a student gives at registration for joining,
-- shown to the approver. Cleared on approval. Stored on the profile so it works for
-- both class-link and general-link registrants.
alter table profiles add column join_reason text;
