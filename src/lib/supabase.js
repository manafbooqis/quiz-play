import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || ""
  );
}

export async function getProfile(userId) {
  return supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
}

export async function upsertProfile(profile) {
  return supabase.from("profiles").upsert(profile, { onConflict: "id" });
}

export async function getSessionById(gameCode) {
  return supabase
    .from("sessions")
    .select("*")
    .eq("game_code", gameCode)
    .maybeSingle();
}

export async function getSessionsByOwner(ownerUid) {
  return supabase
    .from("sessions")
    .select("*")
    .eq("owner_uid", ownerUid)
    .order("created_at", { ascending: false });
}

export async function createSession(sessionPayload) {
  // Remove any manual id - let Supabase generate UUID
  const { id, ...payloadWithoutId } = sessionPayload;
  return supabase.from("sessions").insert([payloadWithoutId]).select().maybeSingle();
}

export async function updateSessionQuestions(gameCode, questionsByDifficulty) {
  console.log("Questions are stored in the questions table, not in sessions");
  return { data: null, error: null };
}

export async function getSessionPlayers(gameCodeOrSessionId) {
  let sessionId = gameCodeOrSessionId;

  if (!isUuid(gameCodeOrSessionId)) {
    const { data: session, error: sessionError } = await getSessionById(
      gameCodeOrSessionId
    );

    if (sessionError) {
      return { data: null, error: sessionError };
    }

    if (!session) {
      return { data: [], error: null };
    }

    sessionId = session.id;
  }

  const { data, error } = await supabase
    .from("session_players")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) {
    return { data: null, error };
  }

  const normalizedPlayers = (data || []).map((player) => ({
    ...player,
    name: player.student_name,
  }));

  return { data: normalizedPlayers, error: null };
}

export async function insertSessionPlayer(player) {
  let sessionId = player.session_id;

  if (!isUuid(sessionId)) {
    const { data: session, error: sessionError } = await getSessionById(sessionId);

    if (sessionError) {
      return { data: null, error: sessionError };
    }

    if (!session) {
      return {
        data: null,
        error: new Error("Session not found for the provided game code."),
      };
    }

    sessionId = session.id;
  }

  const payload = {
    session_id: sessionId,
    student_name: player.student_name || player.name,
    joined_at: player.joined_at || new Date().toISOString(),
  };

  return supabase.from("session_players").insert([payload]).select().maybeSingle();
}