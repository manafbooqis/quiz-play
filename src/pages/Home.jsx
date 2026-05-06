import { Link } from "react-router-dom";

function Home() {
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: `${(i * 11) % 100}%`,
    top: `${(i * 19) % 100}%`,
    duration: `${2 + (i % 5)}s`,
    size: `${3 + (i % 3)}px`,
  }));

  return (
    <div className="relative min-h-screen overflow-hidden text-white bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.18),_transparent_28%),linear-gradient(135deg,#020617_0%,#081129_42%,#030712_100%)]">
      {/* floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full bg-cyan-300/60 animate-pulse"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDuration: p.duration,
              filter: "blur(1px)",
            }}
          />
        ))}
      </div>

      {/* animated glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-6rem] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl animate-pulse" />
        <div className="absolute right-[-10rem] top-16 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl animate-pulse" />
      </div>

      {/* scanlines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.45)_50%,transparent_100%)] bg-[length:100%_5px]" />

      {/* moving hud border */}
      <div className="pointer-events-none absolute inset-4 rounded-[32px] border border-cyan-300/10" />
      <div className="pointer-events-none absolute inset-6 rounded-[28px] border border-fuchsia-300/10 animate-pulse" />

      {/* login */}
      <Link
        to="/instructor/login"
        className="absolute top-5 left-5 z-20 rounded-2xl px-4 py-3 border border-cyan-300/20 bg-white/5 backdrop-blur-xl shadow-[0_0_20px_rgba(34,211,238,0.08)] hover:border-cyan-300/40 hover:bg-white/10 transition"
        aria-label="Go to instructor login"
      >
        <span className="text-xl">👤</span>
      </Link>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-5xl animate-[fadein_0.8s_ease-out]">
          {/* intro */}
          <div className="text-center mb-14">
            <p className="text-xs md:text-sm uppercase tracking-[0.45em] text-cyan-300 font-bold mb-5">
              Quiz Play Arena
            </p>

            <h1 className="game-font text-6xl md:text-8xl font-black bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-violet-400 bg-clip-text text-transparent animate-pulse drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]">
              Quiz Play
            </h1>

            <p className="mt-5 text-slate-300 text-lg md:text-xl max-w-2xl mx-auto">
              Choose your role, enter the arena, and launch the next live quiz
              experience.
            </p>

            <div className="mt-6 text-xs uppercase tracking-[0.3em] text-slate-400 animate-pulse">
              Press a mode to begin
            </div>
          </div>

          {/* cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            <Link to="/student/join">
              <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-8 md:p-10 transition duration-300 hover:border-cyan-300/30 hover:shadow-[0_0_35px_rgba(34,211,238,0.14)] hover:-translate-y-1 cursor-pointer">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_35%)]" />

                <div className="absolute top-0 left-0 h-[2px] w-16 bg-cyan-300/70 group-hover:w-full transition-all duration-500" />
                <div className="absolute bottom-0 right-0 h-[2px] w-16 bg-cyan-300/70 group-hover:w-full transition-all duration-500" />

                <div className="relative z-10">
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 border border-cyan-300/20 text-2xl">
                    🎮
                  </div>

                  <h2 className="game-font text-3xl md:text-4xl text-cyan-300 font-black mb-4">
                    Student
                  </h2>

                  <p className="text-slate-300 leading-7">
                    Join a live quiz, answer fast, and climb the leaderboard
                    against other players.
                  </p>

                  <div className="mt-7 inline-flex items-center gap-2 text-cyan-200 font-bold">
                    Enter Match
                    <span>→</span>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/instructor/dashboard-official">
              <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-8 md:p-10 transition duration-300 hover:border-fuchsia-300/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.14)] hover:-translate-y-1 cursor-pointer">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-[radial-gradient(circle_at_top_right,_rgba(168,85,247,0.12),_transparent_35%)]" />

                <div className="absolute top-0 left-0 h-[2px] w-16 bg-fuchsia-300/70 group-hover:w-full transition-all duration-500" />
                <div className="absolute bottom-0 right-0 h-[2px] w-16 bg-fuchsia-300/70 group-hover:w-full transition-all duration-500" />

                <div className="relative z-10">
                  <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-400/10 border border-fuchsia-300/20 text-2xl">
                    🚀
                  </div>

                  <h2 className="game-font text-3xl md:text-4xl text-fuchsia-300 font-black mb-4">
                    Instructor
                  </h2>

                  <p className="text-slate-300 leading-7">
                    Build quiz battles, control live sessions, and track
                    performance from your command center.
                  </p>

                  <div className="mt-7 inline-flex items-center gap-2 text-fuchsia-200 font-bold">
                    Open Control Hub
                    <span>→</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* footer */}
          <div className="mt-12 text-center text-xs uppercase tracking-[0.25em] text-slate-400">
            Live • Competitive • Real-Time
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadein {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default Home;