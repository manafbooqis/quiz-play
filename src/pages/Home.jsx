import { Link } from "react-router-dom";

function Home() {
  return (
    <>
      {/* Rich Racing Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden pointer-events-none">
        
        {/* Layered depth glows */}
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/5 via-transparent to-pink-400/5 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-gradient-radial from-cyan-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 bg-gradient-radial from-pink-400/8 via-transparent to-transparent opacity-60" style={{ background: 'radial-gradient(circle at 70% 50%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)' }} />
        
        {/* Stronger curved neon racing lanes */}
        <div className="absolute inset-0">
          {/* Left side - enhanced cyan/blue racing track */}
          <svg className="absolute top-0 left-0 w-1/2 h-full" viewBox="0 0 400 800" style={{ opacity: 0.9 }}>
            <defs>
              <linearGradient id="cyanTrack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#0891b2" stopOpacity="1" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0.5" />
              </linearGradient>
              <filter id="cyanGlow">
                <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path
              d="M 30 0 Q 150 200 50 400 T 70 800"
              stroke="url(#cyanTrack)"
              strokeWidth="8"
              fill="none"
              filter="url(#cyanGlow)"
              className="animate-pulse"
              style={{ animationDuration: '3s' }}
            />
            <path
              d="M 10 0 Q 130 200 30 400 T 50 800"
              stroke="#06b6d4"
              strokeWidth="4"
              fill="none"
              opacity="0.6"
              className="animate-pulse"
              style={{ animationDelay: '1s', animationDuration: '3s' }}
            />
            <path
              d="M 50 0 Q 170 200 70 400 T 90 800"
              stroke="#0891b2"
              strokeWidth="3"
              fill="none"
              opacity="0.4"
              className="animate-pulse"
              style={{ animationDelay: '2s', animationDuration: '3s' }}
            />
            <path
              d="M 70 0 Q 190 200 90 400 T 110 800"
              stroke="#0e7490"
              strokeWidth="2"
              fill="none"
              opacity="0.2"
              className="animate-pulse"
              style={{ animationDelay: '3s', animationDuration: '3s' }}
            />
          </svg>
          
          {/* Right side - enhanced pink/purple racing track */}
          <svg className="absolute top-0 right-0 w-1/2 h-full" viewBox="0 0 400 800" style={{ opacity: 0.9 }}>
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
            <path
              d="M 370 0 Q 250 200 350 400 T 330 800"
              stroke="url(#pinkTrack)"
              strokeWidth="8"
              fill="none"
              filter="url(#pinkGlow)"
              className="animate-pulse"
              style={{ animationDuration: '3s', animationDelay: '1.5s' }}
            />
            <path
              d="M 390 0 Q 270 200 370 400 T 350 800"
              stroke="#ec4899"
              strokeWidth="4"
              fill="none"
              opacity="0.6"
              className="animate-pulse"
              style={{ animationDelay: '2.5s', animationDuration: '3s' }}
            />
            <path
              d="M 350 0 Q 230 200 330 400 T 310 800"
              stroke="#db2777"
              strokeWidth="3"
              fill="none"
              opacity="0.4"
              className="animate-pulse"
              style={{ animationDelay: '3.5s', animationDuration: '3s' }}
            />
            <path
              d="M 330 0 Q 210 200 310 400 T 290 800"
              stroke="#be185d"
              strokeWidth="2"
              fill="none"
              opacity="0.2"
              className="animate-pulse"
              style={{ animationDelay: '4.5s', animationDuration: '3s' }}
            />
          </svg>
        </div>

        {/* Enhanced speed lines */}
        <div className="absolute top-1/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-pulse" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-pink-400/60 to-transparent animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
        <div className="absolute top-3/4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
        <div className="absolute top-1/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-pulse" style={{ animationDelay: '2.1s', animationDuration: '2s' }} />
        <div className="absolute top-5/6 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-400/30 to-transparent animate-pulse" style={{ animationDelay: '2.8s', animationDuration: '2s' }} />
        
        {/* More diagonal speed streaks */}
        <div className="absolute top-20 right-1/4 w-48 h-1.5 bg-gradient-to-l from-transparent via-cyan-400/40 to-transparent transform rotate-45 animate-pulse" style={{ animationDelay: '0.3s', animationDuration: '2s' }} />
        <div className="absolute bottom-32 left-1/4 w-40 h-1.5 bg-gradient-to-r from-transparent via-pink-400/40 to-transparent transform rotate-12 animate-pulse" style={{ animationDelay: '1s', animationDuration: '2s' }} />
        <div className="absolute top-60 left-1/3 w-36 h-1 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent transform -rotate-12 animate-pulse" style={{ animationDelay: '1.7s', animationDuration: '2s' }} />
        <div className="absolute bottom-48 right-1/3 w-44 h-1 bg-gradient-to-l from-transparent via-pink-400/35 to-transparent transform -rotate-6 animate-pulse" style={{ animationDelay: '2.3s', animationDuration: '2s' }} />
        <div className="absolute top-40 right-1/3 w-32 h-0.5 bg-gradient-to-l from-transparent via-cyan-400/25 to-transparent transform rotate-6 animate-pulse" style={{ animationDelay: '3s', animationDuration: '2s' }} />
        <div className="absolute bottom-60 left-1/3 w-28 h-0.5 bg-gradient-to-r from-transparent via-pink-400/25 to-transparent transform -rotate-3 animate-pulse" style={{ animationDelay: '3.7s', animationDuration: '2s' }} />

        {/* Enhanced checkered flag patterns */}
        <div className="absolute bottom-12 right-12 w-20 h-20 opacity-20">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-24 left-16 w-12 h-12 opacity-15">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-20 left-24 w-10 h-10 opacity-12">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-48 right-20 w-8 h-8 opacity-10">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>

        {/* Rich decorative background elements */}
        
        {/* Tiny question marks - cyan side */}
        <div className="absolute top-16 left-8 w-3 h-3 text-cyan-300/30 animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '3s' }}>
          <span className="text-lg">?</span>
        </div>
        <div className="absolute top-28 left-24 w-2 h-2 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.1s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-64 left-16 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.7s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute bottom-24 left-8 w-3 h-3 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.3s', animationDuration: '3s' }}>
          <span className="text-lg">?</span>
        </div>
        
        {/* Tiny question marks - pink side */}
        <div className="absolute top-20 right-8 w-3 h-3 text-pink-300/30 animate-pulse" style={{ animationDelay: '1.8s', animationDuration: '3s' }}>
          <span className="text-lg">?</span>
        </div>
        <div className="absolute top-48 right-24 w-2 h-2 text-pink-300/25 animate-pulse" style={{ animationDelay: '3.4s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute bottom-32 right-12 w-2 h-2 text-pink-300/20 animate-pulse" style={{ animationDelay: '0.9s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        
        {/* Tiny trophies */}
        <div className="absolute top-12 left-32 w-4 h-4 text-yellow-300/35 animate-pulse" style={{ animationDelay: '2.6s', animationDuration: '4s' }}>
          <span className="text-xl">🏆</span>
        </div>
        <div className="absolute bottom-16 right-32 w-3 h-3 text-yellow-300/30 animate-pulse" style={{ animationDelay: '4.2s', animationDuration: '4s' }}>
          <span className="text-lg">🏆</span>
        </div>
        <div className="absolute top-72 right-40 w-2 h-2 text-yellow-300/25 animate-pulse" style={{ animationDelay: '1.1s', animationDuration: '4s' }}>
          <span className="text-base">🏆</span>
        </div>
        
        {/* Tiny lightning bolts */}
        <div className="absolute top-36 left-8 w-3 h-3 text-cyan-300/40 animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2.5s' }}>
          <span className="text-xl">⚡</span>
        </div>
        <div className="absolute top-56 left-28 w-2 h-2 text-cyan-300/30 animate-pulse" style={{ animationDelay: '2.9s', animationDuration: '2.5s' }}>
          <span className="text-lg">⚡</span>
        </div>
        <div className="absolute bottom-40 right-8 w-3 h-3 text-pink-300/35 animate-pulse" style={{ animationDelay: '3.1s', animationDuration: '2.5s' }}>
          <span className="text-xl">⚡</span>
        </div>
        <div className="absolute bottom-20 right-24 w-2 h-2 text-pink-300/25 animate-pulse" style={{ animationDelay: '4.6s', animationDuration: '2.5s' }}>
          <span className="text-lg">⚡</span>
        </div>
        
        {/* Tiny checkered flags */}
        <div className="absolute top-8 left-48 w-2 h-2 opacity-15 animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-8 right-48 w-2 h-2 opacity-12 animate-pulse" style={{ animationDelay: '3.8s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-40 right-36 w-1.5 h-1.5 opacity-10 animate-pulse" style={{ animationDelay: '2.2s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        
        {/* Tiny stars and sparkles */}
        <div className="absolute top-24 left-40 w-2 h-2 text-cyan-300/35 animate-pulse" style={{ animationDelay: '1.9s', animationDuration: '2s' }}>
          <span className="text-lg">✨</span>
        </div>
        <div className="absolute top-52 right-40 w-2 h-2 text-pink-300/30 animate-pulse" style={{ animationDelay: '3.3s', animationDuration: '2s' }}>
          <span className="text-lg">✨</span>
        </div>
        <div className="absolute bottom-36 left-36 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '0.4s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute bottom-52 right-36 w-1.5 h-1.5 text-pink-300/20 animate-pulse" style={{ animationDelay: '4.1s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute top-68 left-44 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.7s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute top-12 right-44 w-1 h-1 text-pink-300/15 animate-pulse" style={{ animationDelay: '4.8s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        
        {/* Tiny game symbols */}
        <div className="absolute top-32 left-12 w-2 h-2 text-cyan-300/30 animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '3.5s' }}>
          <span className="text-lg">🎮</span>
        </div>
        <div className="absolute top-64 right-12 w-2 h-2 text-pink-300/25 animate-pulse" style={{ animationDelay: '3.6s', animationDuration: '3.5s' }}>
          <span className="text-lg">🎯</span>
        </div>
        <div className="absolute bottom-28 left-20 w-1.5 h-1.5 text-cyan-300/20 animate-pulse" style={{ animationDelay: '4.3s', animationDuration: '3.5s' }}>
          <span className="text-base">🎮</span>
        </div>
        <div className="absolute bottom-12 right-20 w-1.5 h-1.5 text-pink-300/15 animate-pulse" style={{ animationDelay: '0.6s', animationDuration: '3.5s' }}>
          <span className="text-base">🎯</span>
        </div>
        
        {/* Tiny glowing dots/particles */}
        <div className="absolute top-8 left-20 w-1.5 h-1.5 bg-cyan-400/25 rounded-full animate-ping" style={{ animationDelay: '0.8s' }} />
        <div className="absolute top-16 right-20 w-1 h-1 bg-pink-400/20 rounded-full animate-ping" style={{ animationDelay: '2.3s' }} />
        <div className="absolute top-40 left-8 w-1 h-1 bg-cyan-400/20 rounded-full animate-ping" style={{ animationDelay: '3.9s' }} />
        <div className="absolute top-40 right-8 w-1.5 h-1.5 bg-pink-400/25 rounded-full animate-ping" style={{ animationDelay: '1.4s' }} />
        <div className="absolute bottom-32 left-12 w-1 h-1 bg-cyan-400/15 rounded-full animate-ping" style={{ animationDelay: '4.5s' }} />
        <div className="absolute bottom-32 right-12 w-1 h-1 bg-pink-400/15 rounded-full animate-ping" style={{ animationDelay: '2.8s' }} />
        <div className="absolute bottom-8 left-36 w-1.5 h-1.5 bg-cyan-400/20 rounded-full animate-ping" style={{ animationDelay: '3.2s' }} />
        <div className="absolute bottom-8 right-36 w-1 h-1 bg-pink-400/15 rounded-full animate-ping" style={{ animationDelay: '1.7s' }} />
        <div className="absolute top-48 left-36 w-1 h-1 bg-cyan-400/15 rounded-full animate-ping" style={{ animationDelay: '4.7s' }} />
        <div className="absolute top-48 right-36 w-1 h-1 bg-pink-400/15 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
        
        {/* Tiny neon geometric shapes */}
        <div className="absolute top-20 left-56 w-2 h-2 border-2 border-cyan-400/20 rotate-45 animate-pulse" style={{ animationDelay: '2.4s', animationDuration: '3s' }} />
        <div className="absolute top-60 right-56 w-1.5 h-1.5 border-2 border-pink-400/15 rotate-45 animate-pulse" style={{ animationDelay: '4.9s', animationDuration: '3s' }} />
        <div className="absolute bottom-24 left-56 w-1 h-1 border-2 border-cyan-400/15 rotate-45 animate-pulse" style={{ animationDelay: '1.6s', animationDuration: '3s' }} />
        <div className="absolute bottom-48 right-56 w-1.5 h-1.5 border-2 border-pink-400/12 rotate-45 animate-pulse" style={{ animationDelay: '3.5s', animationDuration: '3s' }} />
        
        {/* Additional elements to fill empty spaces */}
        
        {/* More question marks for empty areas */}
        <div className="absolute top-8 left-64 w-2 h-2 text-cyan-300/20 animate-pulse" style={{ animationDelay: '3.2s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-72 left-64 w-1.5 h-1.5 text-cyan-300/15 animate-pulse" style={{ animationDelay: '1.8s', animationDuration: '3s' }}>
          <span className="text-base">?</span>
        </div>
        <div className="absolute top-8 right-64 w-2 h-2 text-pink-300/20 animate-pulse" style={{ animationDelay: '2.6s', animationDuration: '3s' }}>
          <span className="text-sm">?</span>
        </div>
        <div className="absolute top-72 right-64 w-1.5 h-1.5 text-pink-300/15 animate-pulse" style={{ animationDelay: '4.3s', animationDuration: '3s' }}>
          <span className="text-base">?</span>
        </div>
        
        {/* More sparkles for sparse areas */}
        <div className="absolute top-4 left-32 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '1.1s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute top-4 right-32 w-1.5 h-1.5 text-pink-300/20 animate-pulse" style={{ animationDelay: '3.7s', animationDuration: '2s' }}>
          <span className="text-base">✨</span>
        </div>
        <div className="absolute bottom-4 left-32 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '2.9s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        <div className="absolute bottom-4 right-32 w-1 h-1 text-pink-300/15 animate-pulse" style={{ animationDelay: '4.5s', animationDuration: '2s' }}>
          <span className="text-sm">✨</span>
        </div>
        
        {/* More tiny dots for empty corners */}
        <div className="absolute top-12 left-4 w-1 h-1 bg-cyan-400/20 rounded-full animate-ping" style={{ animationDelay: '1.3s' }} />
        <div className="absolute top-28 left-4 w-1 h-1 bg-cyan-400/15 rounded-full animate-ping" style={{ animationDelay: '3.8s' }} />
        <div className="absolute top-44 left-4 w-1 h-1 bg-cyan-400/18 rounded-full animate-ping" style={{ animationDelay: '2.1s' }} />
        <div className="absolute top-60 left-4 w-1 h-1 bg-cyan-400/12 rounded-full animate-ping" style={{ animationDelay: '4.7s' }} />
        <div className="absolute top-76 left-4 w-1 h-1 bg-cyan-400/10 rounded-full animate-ping" style={{ animationDelay: '0.9s' }} />
        
        <div className="absolute top-12 right-4 w-1 h-1 bg-pink-400/20 rounded-full animate-ping" style={{ animationDelay: '2.4s' }} />
        <div className="absolute top-28 right-4 w-1 h-1 bg-pink-400/15 rounded-full animate-ping" style={{ animationDelay: '4.1s' }} />
        <div className="absolute top-44 right-4 w-1 h-1 bg-pink-400/18 rounded-full animate-ping" style={{ animationDelay: '1.6s' }} />
        <div className="absolute top-60 right-4 w-1 h-1 bg-pink-400/12 rounded-full animate-ping" style={{ animationDelay: '3.3s' }} />
        <div className="absolute top-76 right-4 w-1 h-1 bg-pink-400/10 rounded-full animate-ping" style={{ animationDelay: '0.7s' }} />
        
        {/* More geometric shapes for empty spaces */}
        <div className="absolute top-16 left-72 w-1.5 h-1.5 border border-cyan-400/15 rounded-full animate-pulse" style={{ animationDelay: '2.8s', animationDuration: '3s' }} />
        <div className="absolute top-48 left-72 w-1 h-1 border border-cyan-400/12 rounded-full animate-pulse" style={{ animationDelay: '4.2s', animationDuration: '3s' }} />
        <div className="absolute bottom-32 left-72 w-1.5 h-1.5 border border-cyan-400/10 rounded-full animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '3s' }} />
        
        <div className="absolute top-16 right-72 w-1.5 h-1.5 border border-pink-400/15 rounded-full animate-pulse" style={{ animationDelay: '3.1s', animationDuration: '3s' }} />
        <div className="absolute top-48 right-72 w-1 h-1 border border-pink-400/12 rounded-full animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '3s' }} />
        <div className="absolute bottom-32 right-72 w-1.5 h-1.5 border border-pink-400/10 rounded-full animate-pulse" style={{ animationDelay: '4.6s', animationDuration: '3s' }} />
        
        {/* More tiny trophies for sparse areas */}
        <div className="absolute top-36 left-64 w-1.5 h-1.5 text-yellow-300/20 animate-pulse" style={{ animationDelay: '2.2s', animationDuration: '4s' }}>
          <span className="text-base">🏆</span>
        </div>
        <div className="absolute bottom-56 left-64 w-1 h-1 text-yellow-300/15 animate-pulse" style={{ animationDelay: '3.9s', animationDuration: '4s' }}>
          <span className="text-sm">🏆</span>
        </div>
        <div className="absolute top-36 right-64 w-1.5 h-1.5 text-yellow-300/20 animate-pulse" style={{ animationDelay: '1.7s', animationDuration: '4s' }}>
          <span className="text-base">🏆</span>
        </div>
        <div className="absolute bottom-56 right-64 w-1 h-1 text-yellow-300/15 animate-pulse" style={{ animationDelay: '4.4s', animationDuration: '4s' }}>
          <span className="text-sm">🏆</span>
        </div>
        
        {/* More lightning for empty vertical spaces */}
        <div className="absolute top-24 left-4 w-1.5 h-1.5 text-cyan-300/25 animate-pulse" style={{ animationDelay: '2.5s', animationDuration: '2.5s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute top-52 left-4 w-1 h-1 text-cyan-300/20 animate-pulse" style={{ animationDelay: '4.8s', animationDuration: '2.5s' }}>
          <span className="text-sm">⚡</span>
        </div>
        <div className="absolute top-24 right-4 w-1.5 h-1.5 text-pink-300/25 animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '2.5s' }}>
          <span className="text-base">⚡</span>
        </div>
        <div className="absolute top-52 right-4 w-1 h-1 text-pink-300/20 animate-pulse" style={{ animationDelay: '3.6s', animationDuration: '2.5s' }}>
          <span className="text-sm">⚡</span>
        </div>
        
        {/* More checkered flags for empty horizontal spaces */}
        <div className="absolute top-40 left-4 w-1 h-1 opacity-12 animate-pulse" style={{ animationDelay: '2.7s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute top-40 right-4 w-1 h-1 opacity-10 animate-pulse" style={{ animationDelay: '1.9s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-16 left-4 w-1 h-1 opacity-8 animate-pulse" style={{ animationDelay: '3.4s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        <div className="absolute bottom-16 right-4 w-1 h-1 opacity-8 animate-pulse" style={{ animationDelay: '0.8s', animationDuration: '3s' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-white"></div>
            <div className="bg-black"></div>
            <div className="bg-black"></div>
            <div className="bg-white"></div>
          </div>
        </div>
        
        {/* Enhanced floating game/racing particles (existing) */}
        <div className="absolute top-20 left-12 w-5 h-5 bg-cyan-400/30 rounded-full animate-ping border border-cyan-400/50" />
        <div className="absolute top-44 right-20 w-4 h-4 bg-pink-400/30 rounded-full animate-ping border border-pink-400/50" style={{ animationDelay: '1.8s' }} />
        <div className="absolute bottom-36 left-1/3 w-6 h-6 bg-yellow-300/25 rounded-lg animate-pulse border border-yellow-300/40" style={{ animationDelay: '0.8s' }}>
          <span className="text-yellow-300/80 text-sm flex items-center justify-center h-full">🏆</span>
        </div>
        <div className="absolute top-60 right-1/3 w-5 h-5 bg-cyan-400/25 rounded-full animate-pulse border border-cyan-400/40" style={{ animationDelay: '2.8s' }}>
          <span className="text-cyan-300/80 text-sm flex items-center justify-center h-full">?</span>
        </div>
        <div className="absolute bottom-60 right-16 w-4 h-4 bg-pink-400/25 rounded-full animate-ping border border-pink-400/40" style={{ animationDelay: '2.3s' }} />
        <div className="absolute top-76 left-1/4 w-5 h-5 bg-cyan-400/20 rounded animate-pulse border border-cyan-400/30" style={{ animationDelay: '1.3s' }}>
          <span className="text-cyan-300/70 text-sm flex items-center justify-center h-full">⚡</span>
        </div>
        <div className="absolute bottom-44 left-16 w-4 h-4 bg-pink-400/20 rounded-full animate-ping border border-pink-400/30" style={{ animationDelay: '3.3s' }} />
        <div className="absolute top-32 right-12 w-3 h-3 bg-yellow-300/20 rounded-full animate-pulse border border-yellow-300/30" style={{ animationDelay: '2s' }}>
          <span className="text-yellow-300/70 text-xs flex items-center justify-center h-full">🏁</span>
        </div>
        <div className="absolute top-52 left-20 w-3 h-3 bg-cyan-400/15 rounded-full animate-ping border border-cyan-400/25" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-28 right-28 w-3 h-3 bg-pink-400/15 rounded-full animate-pulse border border-pink-400/25" style={{ animationDelay: '4.5s' }} />
        <div className="absolute top-68 left-32 w-2 h-2 bg-yellow-300/15 rounded-full animate-ping border border-yellow-300/25" style={{ animationDelay: '5s' }} />

        {/* Enhanced HUD decorations */}
        <div className="absolute top-8 right-8 text-cyan-400/60 font-mono text-sm animate-pulse">
          <div>LAP: 01</div>
          <div>TIME: --:--</div>
          <div className="text-xs mt-1">BEST: --:--</div>
          <div className="text-xs mt-1">SPEED: 0</div>
        </div>
        <div className="absolute bottom-8 left-8 text-pink-400/50 font-mono text-sm animate-pulse" style={{ animationDelay: '1s' }}>
          <div>SPEED: 0</div>
          <div>GEAR: N</div>
          <div className="text-xs mt-1">MODE: RACE</div>
          <div className="text-xs mt-1">POS: 1</div>
        </div>
        <div className="absolute top-32 left-8 text-cyan-400/40 font-mono text-xs animate-pulse" style={{ animationDelay: '2s' }}>
          <div>TRACK: 01</div>
          <div>WEATHER: CLEAR</div>
        </div>
        <div className="absolute bottom-32 right-8 text-pink-400/35 font-mono text-xs animate-pulse" style={{ animationDelay: '3s' }}>
          <div>LAPS: 3/5</div>
          <div>FUEL: 100%</div>
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

      {/* Radial overlay for depth */}
      <div className="fixed inset-0 bg-gradient-radial from-transparent via-slate-900/20 to-slate-900/40 pointer-events-none z-20" style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(15, 23, 42, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%)' }} />
      
      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-6 z-30">

        <div className="w-full max-w-4xl text-center">
          {/* Enhanced Premium Hero Title */}
          <div className="mb-12">
            <h1 className="game-font text-6xl md:text-8xl font-bold mb-4 relative">
              {/* Stronger neon glow background */}
              <span className="absolute inset-0 blur-3xl bg-gradient-to-r from-yellow-300/60 via-cyan-300/50 to-pink-300/60 animate-pulse" style={{ animationDuration: '3s' }} />
              <span className="absolute inset-0 blur-xl bg-gradient-to-r from-yellow-300/40 via-cyan-300/30 to-pink-300/40 animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3s' }} />
              
              {/* Speed streaks behind title */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent transform skew-x-12 animate-pulse" style={{ animationDelay: '0.7s', animationDuration: '2s' }} />
              <span className="absolute inset-0 bg-gradient-to-l from-transparent via-pink-400/20 to-transparent transform -skew-x-12 animate-pulse" style={{ animationDelay: '1.4s', animationDuration: '2s' }} />
              
              {/* Main title text */}
              <span className="relative bg-gradient-to-r from-yellow-300 via-cyan-200 to-pink-300 bg-clip-text text-transparent drop-shadow-lg">
                Quiz Play
              </span>
            </h1>
            <p className="text-slate-300 text-xl md:text-2xl font-light relative">
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 to-pink-400/10 blur-sm animate-pulse" style={{ animationDuration: '4s' }} />
              <span className="relative">Choose your role and start the racing experience</span>
            </p>
          </div>

          {/* Premium Role Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Enhanced Student Card */}
            <Link to="/student/join" className="group">
              <div className="relative bg-slate-800/70 backdrop-blur-xl rounded-3xl p-10 shadow-3xl border-2 border-cyan-400/50 hover:border-cyan-400/90 transition-all duration-500 hover:scale-105 hover:shadow-cyan-400/40 hover:shadow-4xl overflow-hidden">
                {/* Enhanced animated background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/15 via-transparent to-blue-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 bg-cyan-400/8 animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                {/* Enhanced Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-400/25 rounded-full animate-ping" />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-500/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="relative bg-cyan-500/30 backdrop-blur-md rounded-2xl p-5 border-2 border-cyan-400/50 shadow-lg group-hover:shadow-cyan-400/50 group-hover:shadow-xl transition-all duration-300">
                      {/* Flag for Racing/Competition */}
                      <svg className="w-14 h-14 text-cyan-200" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.4,6L14,4H5V21H7V14H12.6L13,16H20V6M14,8H18V14H13.6L13.2,12H7V8H14Z" />
                      </svg>
                      {/* Zap Accent */}
                      <svg className="w-10 h-10 text-cyan-300 absolute -bottom-2 -right-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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

                {/* Enhanced CTA Button */}
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400/25 rounded-xl animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <button className="relative w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-cyan-400/60 hover:shadow-2xl border border-cyan-400/60 hover:border-cyan-400/80 overflow-hidden group">
                    {/* Shine effect on hover */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative">Start Racing</span>
                  </button>
                </div>
              </div>
            </Link>

            {/* Enhanced Instructor Card */}
            <Link to="/instructor/dashboard-official" className="group">
              <div className="relative bg-slate-800/70 backdrop-blur-xl rounded-3xl p-10 shadow-3xl border-2 border-pink-400/50 hover:border-pink-400/90 transition-all duration-500 hover:scale-105 hover:shadow-pink-400/40 hover:shadow-4xl overflow-hidden">
                {/* Enhanced animated background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink-400/15 via-transparent to-purple-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 bg-pink-400/8 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-pink-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                {/* Enhanced Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-pink-400/25 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-400/20 to-purple-500/20 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                    <div className="relative bg-pink-500/30 backdrop-blur-md rounded-2xl p-5 border-2 border-pink-400/50 shadow-lg group-hover:shadow-pink-400/50 group-hover:shadow-xl transition-all duration-300">
                      {/* FileQuestion for Create/Manage */}
                      <svg className="w-14 h-14 text-pink-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        <circle cx="11" cy="11" r="1" fill="currentColor" />
                        <path d="M12 8v3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                      </svg>
                      {/* Check Accent for Management */}
                      <svg className="w-10 h-10 text-pink-300 absolute -bottom-2 -right-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

                {/* Enhanced CTA Button */}
                <div className="relative">
                  <div className="absolute inset-0 bg-pink-400/25 rounded-xl animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-400/20 to-purple-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <button className="relative w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-pink-400/60 hover:shadow-2xl border border-pink-400/60 hover:border-pink-400/80 overflow-hidden group">
                    {/* Shine effect on hover */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative">Control Race</span>
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