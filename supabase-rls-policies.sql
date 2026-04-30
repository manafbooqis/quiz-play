-- =====================================================
-- Supabase RLS Policies for Anonymous Guest Sessions
-- =====================================================
-- Run these SQL commands in your Supabase SQL Editor
-- to enable anonymous sign-in for instructor guest sessions.
-- =====================================================

-- First, ensure the sessions table has the required columns
-- (Run this if the columns don't exist yet)
-- ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false;
-- ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS owner_uid UUID REFERENCES auth.users(id);

-- =====================================================
-- Policy 1: Authenticated instructors can create sessions
-- =====================================================
CREATE POLICY "Authenticated instructors can create sessions"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'authenticated' 
  AND owner_uid = auth.uid()
  AND is_guest = false
);

-- =====================================================
-- Policy 2: Authenticated instructors can read their own sessions
-- =====================================================
CREATE POLICY "Instructors can read their own sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  owner_uid = auth.uid()
);

-- =====================================================
-- Policy 3: Authenticated instructors can update their own sessions
-- =====================================================
CREATE POLICY "Instructors can update their own sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (
  owner_uid = auth.uid()
);

-- =====================================================
-- Policy 4: Authenticated instructors can delete their own sessions
-- =====================================================
CREATE POLICY "Instructors can delete their own sessions"
ON public.sessions
FOR DELETE
TO authenticated
USING (
  owner_uid = auth.uid()
);

-- =====================================================
-- Policy 5: Anonymous (guest) users can create guest sessions only
-- =====================================================
-- This policy allows anonymous authenticated users to create
-- sessions only when is_guest = true and owner_uid matches their ID
CREATE POLICY "Anonymous users can create guest sessions"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.jwt() ->> 'is_anonymous' = 'true'
  AND owner_uid = auth.uid()
  AND is_guest = true
);

-- =====================================================
-- Policy 6: Anonymous (guest) users can read their own guest sessions
-- =====================================================
CREATE POLICY "Anonymous users can read their own guest sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'is_anonymous' = 'true'
  AND owner_uid = auth.uid()
  AND is_guest = true
);

-- =====================================================
-- Policy 7: Anonymous (guest) users can update their own guest sessions
-- =====================================================
CREATE POLICY "Anonymous users can update their own guest sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'is_anonymous' = 'true'
  AND owner_uid = auth.uid()
  AND is_guest = true
);

-- =====================================================
-- Policy 8: Anonymous (guest) users can delete their own guest sessions
-- =====================================================
CREATE POLICY "Anonymous users can delete their own guest sessions"
ON public.sessions
FOR DELETE
TO authenticated
USING (
  auth.jwt() ->> 'is_anonymous' = 'true'
  AND owner_uid = auth.uid()
  AND is_guest = true
);

-- =====================================================
-- Policy 9: Anyone can view sessions with status 'active' or 'waiting'
-- (This allows students to join sessions)
-- =====================================================
CREATE POLICY "Anyone can view active sessions"
ON public.sessions
FOR SELECT
TO anon, authenticated
USING (
  status IN ('active', 'waiting')
);

-- =====================================================
-- IMPORTANT: Disable anonymous insert without auth
-- =====================================================
-- Ensure anon role cannot insert sessions (only read active ones)
DROP POLICY IF EXISTS "Allow anon insert" ON public.sessions;

-- =====================================================
-- Note: For anonymous sign-in to work, you need to enable
-- anonymous sign-in in your Supabase Authentication settings:
-- 1. Go to Authentication > Providers > Email
-- 2. Enable "Allow anonymous sign-ins"
-- 
-- Also ensure your Supabase project has anonymous sign-in enabled
-- in the authentication settings.
-- =====================================================