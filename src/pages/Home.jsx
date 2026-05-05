import { Link } from "react-router-dom";

function Home() {
  return (
    <>
      {/* Premium Racing Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden pointer-events-none">
        
        {/* Curved neon racing lanes */}
        <div className="absolute inset-0">
          {/* Left side - cyan/blue racing track */}
          <svg className="absolute top-0 left-0 w-1/2 h-full" viewBox="0 0 400 800" style={{ opacity: 0.6 }}>
            <defs>
              <linearGradient id="cyanTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#0891b2" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <path
              d="M 50 0 Q 120 200 80 400 T 100 800"
              stroke="url(#cyanTrack)"
              strokeWidth="4"
              fill="none"
              className="animate-pulse"
              style={{ animationDuration: '4s' }}
            />
            <path
              d="M 30 0 Q 100 200 60 400 T 80 800"
              stroke="#06b6d4"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
              className="animate-pulse"
              style={{ animationDelay: '1s', animationDuration: '4s' }}
            />
          </svg>
          
          {/* Right side - pink/purple racing track */}
          <svg className="absolute top-0 right-0 w-1/2 h-full" viewBox="0 0 400 800" style={{ opacity: 0.6 }}>
            <defs>
              <linearGradient id="pinkTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#db2777" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#be185d" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <path
              d="M 350 0 Q 280 200 320 400 T 300 800"
              stroke="url(#pinkTrack)"
              strokeWidth="4"
              fill="none"
              className="animate-pulse"
              style={{ animationDuration: '4s', animationDelay: '2s' }}
            />
            <path
              d="M 370 0 Q 300 200 340 400 T 320 800"
              stroke="#ec4899"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
              className="animate-pulse"
              style={{ animationDelay: '3s', animationDuration: '4s' }}
            />
          </svg>
        </div>

        {/* Subtle speed lines */}
        <div className="absolute top-1/4 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-pulse" />
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-pink-400/30 to-transparent animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-3/4 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-300/20 to-transparent animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Diagonal speed streaks */}
        <div className="absolute top-20 right-1/4 w-32 h-0.5 bg-gradient-to-l from-transparent via-cyan-400/20 to-transparent transform rotate-45 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-32 left-1/4 w-24 h-0.5 bg-gradient-to-r from-transparent via-pink-400/20 to-transparent transform rotate-12 animate-pulse" style={{ animationDelay: '1.5s' }} />

        {/* Checkered flag hints */}
        <div className="absolute bottom-16 right-16 w-12 h-12 opacity-10">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-32 left-20 w-8 h-8 opacity-8">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>

        {/* Floating game/racing particles */}
        <div className="absolute top-24 left-16 w-3 h-3 bg-cyan-400/20 rounded-full animate-ping border border-cyan-400/30" />
        <div className="absolute top-48 right-24 w-2 h-2 bg-pink-400/20 rounded-full animate-ping border border-pink-400/30" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-40 left-1/3 w-4 h-4 bg-yellow-300/15 rounded-lg animate-pulse border border-yellow-300/25" style={{ animationDelay: '1s' }}>
          <span className="text-yellow-300/60 text-xs flex items-center justify-center h-full">🏆</span>
        </div>
        <div className="absolute top-64 right-1/3 w-3 h-3 bg-cyan-400/15 rounded-full animate-pulse border border-cyan-400/25" style={{ animationDelay: '3s' }}>
          <span className="text-cyan-300/60 text-xs flex items-center justify-center h-full">?</span>
        </div>
        <div className="absolute bottom-64 right-20 w-2 h-2 bg-pink-400/15 rounded-full animate-ping border border-pink-400/25" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-80 left-1/4 w-3 h-3 bg-cyan-400/10 rounded animate-pulse border border-cyan-400/20" style={{ animationDelay: '1.5s' }}>
          <span className="text-cyan-300/50 text-xs flex items-center justify-center h-full">⚡</span>
        </div>

        {/* Simple HUD decorations */}
        <div className="absolute top-8 right-8 text-cyan-400/40 font-mono text-xs animate-pulse">
          <div>LAP: 01</div>
          <div>TIME: --:--</div>
        </div>
        <div className="absolute bottom-8 left-8 text-pink-400/30 font-mono text-xs animate-pulse" style={{ animationDelay: '1s' }}>
          <div>SPEED: 0</div>
          <div>GEAR: N</div>
        </div>
      </div>
      
      {/* Fixed Top-Left Login Icon */}
      <Link
        to="/instructor/login"
        className="fixed top-6 left-6 z-50 group"
        aria-label="Go to instructor login"
      >
        <div className="relative bg-slate-800/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border-2 border-cyan-400/60 transition-all duration-300 hover:scale-110 hover:border-cyan-400 hover:shadow-cyan-400/40 hover:shadow-2xl">
          {/* Pulsing outer glow */}
          <div className="absolute -inset-2 rounded-3xl bg-cyan-400/20 animate-pulse" />
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-400/10 to-pink-400/10 animate-pulse" style={{ animationDelay: '1s' }} />
          
          {/* User icon */}
          <svg className="w-6 h-6 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </Link>

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-6 z-10">

        <div className="w-full max-w-4xl text-center">
          {/* Premium Hero Title */}
          <div className="mb-12">
            <h1 className="game-font text-6xl md:text-8xl font-bold mb-4 relative">
              <span className="absolute inset-0 blur-2xl bg-gradient-to-r from-yellow-300/40 via-cyan-300/30 to-pink-300/40 animate-pulse" />
              <span className="relative bg-gradient-to-r from-yellow-300 via-cyan-200 to-pink-300 bg-clip-text text-transparent">
                Quiz Play
              </span>
            </h1>
            <p className="text-slate-300 text-xl md:text-2xl font-light">
              Choose your role and start the racing experience
            </p>
          </div>

          {/* Premium Role Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Student Card */}
            <Link to="/student/join" className="group">
              <div className="relative bg-slate-800/60 backdrop-blur-lg rounded-3xl p-10 shadow-2xl border-2 border-cyan-400/40 hover:border-cyan-400/80 transition-all duration-500 hover:scale-105 hover:shadow-cyan-400/30 hover:shadow-3xl overflow-hidden">
                {/* Animated background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 bg-cyan-400/5 animate-pulse" />
                
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping" />
                    <div className="relative bg-cyan-500/20 backdrop-blur-sm rounded-2xl p-4 border border-cyan-400/40">
                      <svg className="w-12 h-12 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                      </svg>
                      <svg className="w-8 h-8 text-cyan-400 absolute -bottom-1 -right-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <h2 className="game-font text-4xl text-cyan-300 mb-4 group-hover:text-cyan-200 transition-colors">
                  Student
                </h2>
                <p className="text-slate-300 text-lg mb-8 group-hover:text-slate-200 transition-colors">
                  Join live quizzes, compete with others, and race to the top
                </p>

                {/* CTA Button */}
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400/20 rounded-xl animate-pulse" />
                  <button className="relative w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-cyan-400/50 hover:shadow-lg border border-cyan-400/50">
                    Start Racing
                  </button>
                </div>
              </div>
            </Link>

            {/* Instructor Card */}
            <Link to="/instructor/dashboard-official" className="group">
              <div className="relative bg-slate-800/60 backdrop-blur-lg rounded-3xl p-10 shadow-2xl border-2 border-pink-400/40 hover:border-pink-400/80 transition-all duration-500 hover:scale-105 hover:shadow-pink-400/30 hover:shadow-3xl overflow-hidden">
                {/* Animated background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink-400/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 bg-pink-400/5 animate-pulse" style={{ animationDelay: '0.5s' }} />
                
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-pink-400/20 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
                    <div className="relative bg-pink-500/20 backdrop-blur-sm rounded-2xl p-4 border border-pink-400/40">
                      <svg className="w-12 h-12 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <svg className="w-8 h-8 text-pink-400 absolute -bottom-1 -right-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <h2 className="game-font text-4xl text-pink-300 mb-4 group-hover:text-pink-200 transition-colors">
                  Instructor
                </h2>
                <p className="text-slate-300 text-lg mb-8 group-hover:text-slate-200 transition-colors">
                  Create racing quizzes, manage sessions, and track performance
                </p>

                {/* CTA Button */}
                <div className="relative">
                  <div className="absolute inset-0 bg-pink-400/20 rounded-xl animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <button className="relative w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-pink-400/50 hover:shadow-lg border border-pink-400/50">
                    Control Race
                  </button>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;