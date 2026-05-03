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

  const [loading, setLoading] = useState(!state?.responses || !state?.students);
  const [gameCode, setGameCode] = useState(state?.gameCode ?? "");
  const [students, setStudents] = useState(state?.students ?? []);
  const [responses, setResponses] = useState(state?.responses ?? []);
  const [questionsByDifficulty, setQuestionsByDifficulty] = useState(
    state?.questionsByDifficulty ?? {}
  );

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    if (state?.responses && state?.students) {
      setLoading(false);
      return;
    }

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

        if (playersData) {
          setStudents(playersData);
        }

        const { data: responsesData } = await supabase
          .from("responses")
          .select("*")
          .eq("session_id", sessionId);

        if (responsesData) {
          setResponses(responsesData);
        }
      } catch (err) {
        console.error("Error loading score distribution data:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [sessionId, state]);

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

    const topLow = (bucketCount - 1) * bucketSize;

    scores.forEach((s) => {
      if (s > topLow + bucketSize - 1) {
        counts[bucketCount - 1]++;
      }
    });

    return { labels, counts };
  }, [scores, highestScore]);

  const maxBucketCount = Math.max(...buckets.counts, 1);

  function handleExport() {
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
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-slate-700 text-xl font-semibold">
          Loading score distribution...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Score Summary</h1>

            <p className="text-slate-500 mt-1">
              Game Code:{" "}
              <span className="font-semibold">{gameCode || "—"}</span>
            </p>

            <p className="text-slate-500 text-sm mt-1">
              Review student scores and overall performance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
          

            <button
              onClick={() =>
                navigate("/instructor/final-results", {
                  state: {
                    sessionId,
                    gameCode,
                    students,
                    responses,
                    questionsByDifficulty,
                  },
                })
              }
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold"
            >
              Back to Question Analysis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Average Score
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {avgScore}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Highest Score
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {highestScore}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Lowest Score
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {lowestScore}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold">Score Distribution</h2>

              <p className="text-slate-500 text-sm mt-1">
                Number of students in each score range.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
              {ranked.length} students
            </div>
          </div>

          {scores.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="font-semibold text-slate-700">
                No score data available
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Scores will appear after students submit answers.
              </p>
            </div>
          ) : (
            <div className="flex items-end gap-4 h-56">
              {buckets.labels.map((label, index) => {
                const count = buckets.counts[index];
                const heightPct = Math.round((count / maxBucketCount) * 100);

                return (
                  <div
                    key={label}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <span className="text-sm font-bold text-slate-700">
                      {count}
                    </span>

                    <div className="w-full flex items-end h-40 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden">
                      <div
                        className="w-full rounded-t-2xl bg-slate-900 transition-all duration-700"
                        style={{
                          height: `${Math.max(
                            heightPct,
                            count > 0 ? 5 : 0
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="text-xs text-slate-500 font-medium">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold">Student Rankings</h2>

              <p className="text-slate-500 text-sm mt-1">
                Students ordered by total score.
              </p>
            </div>
          </div>

          {ranked.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="font-semibold text-slate-700">
                No students found
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Student results will appear here after the quiz.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ranked.map((student, index) => {
                const medal =
                  index === 0
                    ? "🥇"
                    : index === 1
                    ? "🥈"
                    : index === 2
                    ? "🥉"
                    : null;

                return (
                  <div
                    key={student.id || index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-extrabold text-slate-800 shrink-0">
                          {medal || index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {student.name}
                          </p>

                          <p className="text-sm text-slate-500 mt-0.5">
                            {student.correct}/{student.total} correct
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-2xl font-extrabold text-slate-900">
                          {student.score}
                        </p>

                        <p className="text-xs text-slate-500">points</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InstructorScoreDistribution;