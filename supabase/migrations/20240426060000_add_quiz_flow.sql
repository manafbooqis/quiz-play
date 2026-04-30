-- Add quiz flow fields to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'round_results', 'finished')),
ADD COLUMN IF NOT EXISTS current_question_id TEXT,
ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_difficulty TEXT CHECK (current_difficulty IN ('easy', 'medium', 'hard')),
ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_question_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_question_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS show_round_results BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quiz_finished_at TIMESTAMPTZ;

-- Create responses table for student answers
CREATE TABLE IF NOT EXISTS responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    selected_answer INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_question_id ON responses(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_player_id ON responses(player_id);
CREATE INDEX IF NOT EXISTS idx_responses_round_number ON responses(round_number);

-- Add RLS policies for responses table
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Policy: Instructors can see responses for their own sessions
CREATE POLICY "Instructors can view responses for their sessions" ON responses
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM sessions 
            WHERE owner_uid = auth.uid()
        )
    );

-- Policy: Students can insert their own responses
CREATE POLICY "Students can insert their own responses" ON responses
    FOR INSERT WITH CHECK (
        -- Student can only insert if they belong to session
        EXISTS (
            SELECT 1 FROM public.session_players 
            WHERE session_id = responses.session_id 
            AND student_name = responses.player_id
        )
        -- Also ensure they don't insert duplicate answers for same question
        AND NOT EXISTS (
            SELECT 1 FROM responses 
            WHERE session_id = responses.session_id 
            AND question_id = responses.question_id 
            AND player_id = responses.player_id
        )
    );

-- Policy: Instructors can update responses for their own sessions
CREATE POLICY "Instructors can update responses for their own sessions" ON responses
    FOR UPDATE USING (
        session_id IN (
            SELECT id FROM sessions 
            WHERE owner_uid = auth.uid()
        )
    );

-- Add realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE responses;
