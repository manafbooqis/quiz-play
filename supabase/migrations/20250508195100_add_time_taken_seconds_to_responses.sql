-- Add time_taken_seconds column to responses table
-- This column will store the time taken by students to answer each question
-- Value is clamped between 0 and the round timer duration

ALTER TABLE public.responses
ADD COLUMN IF NOT EXISTS time_taken_seconds integer;
