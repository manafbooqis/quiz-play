import { useState } from "react";
import { supabase } from "../lib/supabase";

function CreateSession() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [loading, setLoading] = useState(false);

  const generateGameCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setGameCode("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const newGameCode = generateGameCode();

      const sessionData = {
        title,
        game_code: newGameCode,
        owner_uid: user?.id ?? null,
        owner_email: user?.email ?? null,
        is_guest: !user,
        status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("sessions")
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        console.error("Create session Supabase error:", JSON.stringify(error, null, 2));
        console.error("Message:", error.message);
        console.error("Details:", error.details);
        console.error("Hint:", error.hint);
        console.error("Code:", error.code);
        throw error;
      }

      setGameCode(data.game_code);

      if (user) {
        setMessage("Session created and saved to Supabase.");
      } else {
        setMessage("Session created as guest session.");
      }

      setTitle("");
    } catch (error) {
      console.error("Create session error:", error);
      setMessage("Something went wrong while creating the session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg bg-slate-800 rounded-2xl shadow-xl p-8">
        <h1 className="game-font text-3xl mb-6 text-center">
          Create Session
        </h1>

        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block mb-2">Session Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter session title"
              className="w-full p-3 rounded-xl bg-slate-700 text-white outline-none border border-slate-600 focus:border-cyan-400"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-700 text-slate-900 font-bold py-3 rounded-xl transition"
          >
            {loading ? "Creating..." : "Create Session"}
          </button>

          {message && (
            <p className="text-sm text-slate-300 text-center">
              {message}
            </p>
          )}

          {gameCode && (
            <div className="mt-4 bg-slate-700 border border-cyan-400 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-300 mb-2">
                Student Game Code
              </p>
              <p className="game-font text-3xl text-cyan-300 tracking-widest">
                {gameCode}
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default CreateSession;