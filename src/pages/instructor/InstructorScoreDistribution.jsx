import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function getStudentName(student, index) {
  if (!student) return `Student ${index + 1}`;
  if (typeof student === "string") return student;
  const candidates = [
    student.student_name,
    student.name,
    student.full_name,
    student.nickname,
    student.display_name,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return `Student ${index + 1}`;
}

function InstructorScoreDistribution() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const sessionId = state?.sessionId ?? "";
  const [loading, setLoading] = useState(
    !state?.responses || !state?.students
  );
  const [gameCode, setGameCode] = useState(state?.gameCode ?? "");
  const [students, setStudents] = useState(state?.students ?? []);
  const [responses, setResponses] = useState(state?.responses ?? []);
  const [questionsByDifficulty, setQuestionsByDifficulty] = useState(
    state?.questionsByDifficulty ?? {}
  );

  // Fallback: load from Supabase if state is incomplete
  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    if (state?.responses && state?.students) { setLoading(false); return; }

    async function load() {
      try {
        const { data: sessionData } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionData) {
          setGameCode(sessionData.game_code || "");
          setQuestionsByDifficulty(sessionData.questions_by_difficulty || {});
        }

        const { data: playersData } = await supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId);
        if (playersData) setStudents(playersData);

        const { data: responsesData } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", sessionId);
        if (responsesData) setResponses(responsesData);
      } catch (err) {
        console.error("Error loading score distribution data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId, state]);

  // Calculate per-student scores
  const studentScores = useMemo(() => {
    return students.map((student, index) => {
      const id = student.id || student.student_name;
      const name = getStudentName(student, index);
      const studentResponses = responses.filter(
        (r) => r.player_id === id || r.player_id === student.student_name
      );
      const score = studentResponses.reduce(
        (acc, r) => acc + Number(r.points_awarded || 0),
        0
      );
      const correct = studentResponses.filter((r) => r.is_correct).length;
      const total = studentResponses.length;
      return { id, name, score, correct, total };
    });
  }, [students, responses]);

  const ranked = useMemo(
    () => [...studentScores].sort((a, b) => b.score - a.score),
    [studentScores]
  );

  const scores = ranked.map((s) => s.score);
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  // Build score-distribution buckets (0-20, 21-40, 41-60, 61-80, 81-100+)
  const buckets = useMemo(() => {
    const MAX = highestScore > 0 ? highestScore : 100;
    const bucketCount = 5;
    const bucketSize = Math.ceil(MAX / bucketCount) || 20;
    const labels = [];
    const counts = [];
    for (let i = 0; i < bucketCount; i++) {
      const low = i * bucketSize;
      const high = (i + 1) * bucketSize - 1;
      labels.push(`${low}–${high}`);
      counts.push(scores.filter((s) => s >= low && s <= high).length);
    }
    // Put any scores above the top bucket into the last one
    const topLow = (bucketCount - 1) * bucketSize;
    scores.forEach((s) => {
      if (s > topLow + bucketSize - 1) counts[bucketCount - 1]++;
    });
    return { labels, counts };
  }, [scores, highestScore]);

  const maxBucketCount = Math.max(...buckets.counts, 1);

  // Export CSV
  const handleExport = () => {
    const rows = [
      ["Rank", "Name", "Score", "Correct Answers", "Total Responses"],
      ...ranked.map((s, i) => [i + 1, s.name, s.score, s.correct, s.total]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `score-distribution-${gameCode || sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 text-xl font-semibold">Loading score distribution...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Score Distribution</h1>
          <p className="text-sm text-slate-500">Game Code: {gameCode || "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm shadow-sm transition"
          >
            Export Results
          </button>
          <button
            onClick={() =>
              navigate("/instructor/final-results", {
                state: { sessionId, gameCode, students, responses, questionsByDifficulty },
              })
            }
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold text-sm shadow-sm"
          >
            ← Back to Questions Analysis
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Average Score", value: avgScore, icon: "📊", color: "blue" },
              { label: "Highest Score", value: highestScore, icon: "🏆", color: "emerald" },
              { label: "Lowest Score", value: lowestScore, icon: "📉", color: "amber" },
            ].map(({ label, value, icon, color }) => (
              <div
                key={label}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex items-center gap-4 relative overflow-hidden group"
              >
                <div
                  className={`absolute -right-4 -top-4 w-24 h-24 rounded-full transition-transform group-hover:scale-110 ${
                    color === "blue" ? "bg-blue-50" :
                    color === "emerald" ? "bg-emerald-50" : "bg-amber-50"
                  }`}
                />
                <div
                  className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                    color === "blue" ? "bg-blue-100" :
                    color === "emerald" ? "bg-emerald-100" : "bg-amber-100"
                  }`}
                >
                  {icon}
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-4xl font-bold text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bar Chart */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Score Distribution Chart</h2>
            {scores.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No student data available.</p>
            ) : (
              <div className="flex items-end gap-4 h-48">
                {buckets.labels.map((label, i) => {
                  const count = buckets.counts[i];
                  const heightPct = Math.round((count / maxBucketCount) * 100);
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-sm font-bold text-slate-600">{count}</span>
                      <div className="w-full flex items-end" style={{ height: "160px" }}>
                        <div
                          className="w-full rounded-t-xl bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-700"
                          style={{ height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ranked Student List */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Student Rankings</h2>
            {ranked.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No students found.</p>
            ) : (
              <div className="space-y-3">
                {ranked.map((student, index) => {
                  const medal =
                    index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
                  const isTop = index < 3;
                  return (
                    <div
                      key={student.id || index}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        isTop
                          ? "border-cyan-100 bg-cyan-50/60"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                          {medal || index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{student.name}</p>
                          <p className="text-xs text-slate-400">
                            {student.correct}/{student.total} correct
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-800">{student.score}</p>
                        <p className="text-xs text-slate-400">points</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default InstructorScoreDistribution;
