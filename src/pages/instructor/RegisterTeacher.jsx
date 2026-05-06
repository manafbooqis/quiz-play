import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, upsertProfile } from "../../lib/supabase";

function RegisterTeacher() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();


  const getRegisterErrorMessage = (message) => {
    if (!message) return "Account creation failed. Please try again.";
    if (message.includes("duplicate key value")) {
      return "This email is already in use.";
    }
    if (message.includes("invalid email")) {
      return "The email format is invalid.";
    }
    if (message.includes("Password should be at least")) {
      return "The password is too weak. Use at least 6 characters.";
    }
    return message;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setLoading(true);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      setErrorCode("custom/missing-name");
      setLoading(false);
      return;
    }

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

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setErrorCode("custom/weak-password");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setErrorCode("custom/password-mismatch");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: "instructor",
          },
        }
      });

      if (error) {
        console.error("Signup error full:", error);
        console.error("Message:", error?.message);
        console.error("Code:", error?.code);
        throw error;
      }

      const user = data.user;

      if (!user) {
        throw new Error("Unable to create account. Please try again.");
      }

      if (!data.session) {
        // Handle case where email confirmation is enabled in Supabase
        setError("Account created successfully. Please check your email to verify your account before logging in.");
        setLoading(false);
        return; 
      }

      // If session exists (email confirmation off), proceed to upsert profile
      await upsertProfile({
        id: user.id,
        full_name: fullName.trim(),
        email: user.email,
        role: "instructor",
        updated_at: new Date().toISOString(),
      });

      navigate("/instructor/dashboard-official");
    } catch (err) {
      console.error("Register error:", err);
      setErrorCode(err?.code || "unknown");
      setError(getRegisterErrorMessage(err?.message || err?.msg || err?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Rich Racing Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden pointer-events-none">
        
        {/* Layered depth glows */}
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/5 via-transparent to-pink-400/5 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-gradient-radial from-cyan-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-pink-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 70% 50%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-yellow-400/4 via-transparent to-transparent opacity-50" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(250, 204, 21, 0.04) 0%, transparent 50%)' }} />
        
        {/* Stronger curved neon racing lanes */}
        <div className="absolute inset-0">
          {/* Left side - enhanced cyan/blue racing track */}
          <svg className="absolute top-0 left-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.7 }}>
            <defs>
              <linearGradient id="cyanTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#0891b2" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0.4" />
              </linearGradient>
              <filter id="cyanGlow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path d="M 50 100 Q 150 200 100 300 T 200 500 Q 250 600 150 700 L 100 800" 
                  stroke="url(#cyanTrack)" strokeWidth="8" fill="none" filter="url(#cyanGlow)" className="animate-pulse" style={{ animationDuration: '3s' }} />
            <path d="M 30 0 Q 130 200 30 400 T 50 800" 
                  stroke="#06b6d4" strokeWidth="4" fill="none" opacity="0.6" className="animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }} />
            <path d="M 70 0 Q 170 200 70 400 T 90 800" 
                  stroke="#0891b2" strokeWidth="3" fill="none" opacity="0.4" className="animate-pulse" style={{ animationDelay: '2s', animationDuration: '3s' }} />
            <path d="M 90 0 Q 190 200 90 400 T 110 800" 
                  stroke="#0e7490" strokeWidth="2" fill="none" opacity="0.2" className="animate-pulse" style={{ animationDelay: '3s', animationDuration: '3s' }} />
          </svg>
          
          {/* Right side - enhanced pink/purple racing track */}
          <svg className="absolute top-0 right-0 w-1/3 h-full" viewBox="0 0 300 800" style={{ opacity: 0.6 }}>
            <defs>
              <linearGradient id="pinkTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#db2777" stopOpacity="1" />
                <stop offset="100%" stopColor="#be185d" stopOpacity="0.5" />
              </linearGradient>
              <filter id="pinkGlow">
                <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path d="M 250 100 Q 150 200 250 300 T 200 500 Q 150 600 250 700 L 200 800" 
                  stroke="url(#pinkTrack)" strokeWidth="8" fill="none" filter="url(#pinkGlow)" className="animate-pulse" style={{ animationDuration: '3s', animationDelay: '1.5s' }} />
            <path d="M 270 0 Q 170 200 270 400 T 250 800" 
                  stroke="#ec4899" strokeWidth="4" fill="none" opacity="0.6" className="animate-pulse" style={{ animationDelay: '2.5s', animationDuration: '3s' }} />
            <path d="M 230 0 Q 130 200 230 400 T 210 800" 
                  stroke="#db2777" strokeWidth="3" fill="none" opacity="0.4" className="animate-pulse" style={{ animationDelay: '3.5s', animationDuration: '3s' }} />
            <path d="M 210 0 Q 110 200 210 400 T 190 800" 
                  stroke="#be185d" strokeWidth="2" fill="none" opacity="0.2" className="animate-pulse" style={{ animationDelay: '4.5s', animationDuration: '3s' }} />
          </svg>
        </div>
        
        {/* Enhanced speed lines */}
        <div className="absolute top-1/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-pink-400/60 to-transparent animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
        <div className="absolute top-3/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
        <div className="absolute top-1/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-pulse" style={{ animationDelay: '2.1s', animationDuration: '2s' }} />
        <div className="absolute top-5/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-400/30 to-transparent animate-pulse" style={{ animationDelay: '2.8s', animationDuration: '2s' }} />
        
        {/* Floating decorative elements */}
        <div className="absolute top-12 left-16 w-3 h-3 bg-cyan-400/25 rounded-full animate-ping border border-cyan-400/40" />
        <div className="absolute top-24 right-20 w-2 h-2 bg-pink-400/20 rounded-full animate-pulse border border-pink-400/30" style={{ animationDelay: '1s' }} />
        <div className="absolute top-40 left-24 w-2.5 h-2.5 bg-yellow-300/15 rounded-full animate-pulse border border-yellow-300/25" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-16 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '1.5s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">⚡</span>
        </div>
        <div className="absolute top-16 left-32 w-1.5 h-1.5 text-cyan-300/15 animate-pulse" style={{ animationDelay: '2.5s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">⚡</span>
        </div>
        <div className="absolute bottom-32 left-20 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3s' }}>
          <span className="text-cyan-300/70 text-xs flex items-center justify-center h-full">🏁</span>
        </div>
      </div>
      
      {/* Radial overlay for depth */}
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-slate-900/20 to-slate-900/40 pointer-events-none z-20" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(15, 23, 42, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%)' }} />
      
      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-6 z-30">
        <div className="relative w-full max-w-md bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-4xl border-2 border-cyan-400/50 p-8 overflow-hidden">
          {/* Enhanced multicolor edge glow effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-400/25 via-blue-400/20 to-pink-400/25 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-amber-400/15 via-transparent to-transparent animate-pulse" style={{ animationDelay: '2s', animationDuration: '4s' }} />
          <div className="absolute inset-0 rounded-3xl border-2 border-transparent bg-gradient-to-r from-cyan-400/30 via-blue-400/30 via-amber-400/30 to-pink-400/30 animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-transparent via-white/5 to-transparent" />
          
          <div className="relative z-10">
        <h1 className="game-font text-3xl text-center text-white mb-2">
          Create Instructor Account
        </h1>

            <p className="text-slate-300 text-center mb-6">
              Create an account to save your quizzes and sessions.
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-white mb-2">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-700/80 backdrop-blur-md text-white outline-none border border-slate-600/50 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/50 transition-all duration-300"
                  required
                />
              </div>

              <div>
                <label className="block text-white mb-2">Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-700/80 backdrop-blur-md text-white outline-none border border-slate-600/50 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/50 transition-all duration-300"
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
                  className="w-full p-3 rounded-xl bg-slate-700/80 backdrop-blur-md text-white outline-none border border-slate-600/50 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/50 transition-all duration-300"
                  required
                />
              </div>

              <div>
                <label className="block text-white mb-2">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-700/80 backdrop-blur-md text-white outline-none border border-slate-600/50 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/50 transition-all duration-300"
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
                className="relative w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-cyan-700 disabled:to-cyan-800 text-slate-900 font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border-2 border-cyan-400/50"
              >
                <div className="absolute inset-0 bg-cyan-400/20 rounded-xl animate-pulse" style={{ animationDuration: '2s' }} />
                <span className="relative z-10">{loading ? "Creating Account..." : "Create Account"}</span>
              </button>
            </form>

            <div className="mt-4">
              <Link
                to="/instructor/login"
                className="block w-full text-center bg-gradient-to-r from-pink-500 to-pink-400 hover:from-pink-400 hover:to-pink-300 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border-2 border-pink-400/50"
              >
                Back to Login
              </Link>
            </div>

            <div className="mt-4 text-center">
              <p className="text-slate-400 text-sm">
                Already have an account? Sign in instead.
              </p>
            </div>
          </div>
          </div>
        </div>
      </>
  );
}

export default RegisterTeacher;
