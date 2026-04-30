import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, upsertProfile } from "../../lib/supabase";

function LoginTeacher() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const getLoginErrorMessage = (message) => {
    if (!message) return "Login failed. Please try again.";
    if (message.includes("Invalid login credentials")) {
      return "Incorrect email or password, or this account does not exist.";
    }
    if (message.includes("Password should be at least")) {
      return "Password must be at least 6 characters.";
    }
    if (message.includes("invalid email")) {
      return "The email format is invalid.";
    }
    return message;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setLoading(true);

    if (!email.trim()) {
      setError("Please enter your email.");
      setErrorCode("custom/missing-email");
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password.");
      setErrorCode("custom/missing-password");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      const user = data.user;

      if (!user) {
        throw new Error("Unable to sign in. Please try again.");
      }

      await upsertProfile({
        id: user.id,
        email: user.email,
        role: "instructor",
        updated_at: new Date().toISOString(),
      });

      navigate("/instructor/dashboard-official");
    } catch (err) {
      console.error("Login error:", err);
      setErrorCode(err?.code || "unknown");
      setError(getLoginErrorMessage(err?.message || err?.msg || err?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-xl p-8">
        <h1 className="game-font text-3xl text-center text-white mb-2">
          Instructor Login
        </h1>

        <p className="text-slate-300 text-center mb-6">
          Sign in to save your work and manage your sessions.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-white mb-2">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-700 text-white outline-none border border-slate-600 focus:border-cyan-400"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-700 text-white outline-none border border-slate-600 focus:border-cyan-400"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3">
              <p className="text-red-300 text-sm font-medium">{error}</p>
              <p className="text-red-200/70 text-xs mt-1">
                Error code: {errorCode}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-700 text-slate-900 font-bold py-3 rounded-xl transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-4">
          <Link
            to="/instructor/register"
            className="block w-full text-center bg-pink-500 hover:bg-pink-400 text-white font-bold py-3 rounded-xl transition"
          >
            Create New Account
          </Link>
        </div>

        <div className="mt-4 text-center">
          <p className="text-slate-400 text-sm">
            New here? Create an account first.
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-600">
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              setError("");
              setErrorCode("");

              try {
                const { data, error: anonError } = await supabase.auth.signInAnonymously();

                if (anonError) {
                  throw anonError;
                }

                const user = data?.user;

                if (!user) {
                  throw new Error("Unable to sign in as guest. Please try again.");
                }

                await upsertProfile({
                  id: user.id,
                  full_name: "Guest Instructor",
                  email: null,
                  role: "instructor",
                  is_guest: true,
                  updated_at: new Date().toISOString(),
                });

                navigate("/instructor/dashboard-official");
              } catch (err) {
                console.error("Guest sign-in error:", err);
                setErrorCode(err?.code || "unknown");
                setError(err?.message || "Failed to continue as guest. Please try again.");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-300 font-bold py-3 rounded-xl transition"
          >
            Continue as Guest
          </button>
          <p className="text-slate-500 text-xs text-center mt-2">
            Guest sessions are saved locally but not linked to an account.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginTeacher;
