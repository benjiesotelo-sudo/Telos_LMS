-- 0008_assignment_meta.sql — per-assignment grading metadata + per-class weights.
create type grade_period as enum ('midterm','final');
alter table assignments add column period grade_period not null default 'midterm';
alter table assignments add column active boolean not null default true;
alter table assignments add column reveal_answers boolean not null default false;
alter table classes add column wt_quiz numeric not null default 0.30;
alter table classes add column wt_paper numeric not null default 0.20;
alter table classes add column wt_exam numeric not null default 0.50;
