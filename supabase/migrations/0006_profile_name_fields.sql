-- 0006_profile_name_fields.sql — structured name parts; full_name becomes app-derived.
alter table profiles add column prefix text not null default '';
alter table profiles add column first_name text not null default '';
alter table profiles add column middle_initial text not null default '';
alter table profiles add column last_name text not null default '';
alter table profiles add column suffix text not null default '';
-- Let users self-edit their own name parts (safe columns; NOT role/status).
grant update (prefix, first_name, middle_initial, last_name, suffix) on public.profiles to authenticated;
