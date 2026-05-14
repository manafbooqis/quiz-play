-- Prevent duplicate responses from the same player for the same question in a session.
ALTER TABLE responses
ADD CONSTRAINT responses_unique_player_question
UNIQUE (session_id, question_id, player_id);
