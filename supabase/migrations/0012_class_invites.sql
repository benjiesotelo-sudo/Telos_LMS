-- 0012_class_invites.sql — in-app class invitations.
-- An instructor invites an existing student → enrollment row with status='invited'
-- (status is free text; 'active'/'pending'/'invited'). The student accepts (→ 'active')
-- or declines (row deleted) from their app. invited_by records who sent it.

alter table enrollments add column invited_by uuid references profiles(id) on delete set null;
alter table enrollments add column invited_at timestamptz;
