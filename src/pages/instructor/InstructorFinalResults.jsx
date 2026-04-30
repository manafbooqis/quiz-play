import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function getTextValue(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

function getStudentName(student, index) {
  if (!student) {
    return `Student ${index + 1}`;
  }
  if (typeof student === "string") {
    return student;
  }
  if (typeof student !== "object") {
    return `Student ${index + 1}`;
  }
  const candidates = [
    student.student_name,
    student.name,
    student.full_name,
    student.nickname,
    student.display_name,
  ];
  for (const candidate of candidates) {
    const text = getTextValue(candidate);
    if (text) return text;
  }
  return `Student ${index + 1}`;
}

function InstructorFinalResults() {
  const navigate = useNavigate();
  const { state } = useLocation();
  
  const sessionId = state?.sessionId ?? "";
  const gameCode = state?.gameCode ?? "";
  const students = state?.students ?? [];
  const responses = state?.responses ?? [];
  const questionsByDifficulty = state?.questionsByDifficulty ?? {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!students.length || !responses.length) {
      return {
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        totalParticipants: 0,
        scoreDistribution: { 0: 0, 25: 0, 50: 0, 75: 0, 100: 0 }
      };
    }

    const studentScores = {};
    students.forEach(student => {
      const studentId = student.id || student.student_name;
      studentScores[studentId] = {
        name: getStudentName(student, 0),
        totalScore: 0,
        responses: []
      };
    });

    responses.forEach(response => {
      const studentId = response.player_id;
      if (studentScores[studentId]) {
        studentScores[studentId].totalScore += response.points_awarded;
        studentScores[studentId].responses.push(response);
      }
    });

    const scores = Object.values(studentScores).map(s => s.totalScore);
    const totalParticipants = scores.length;
    
    const averageScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Score distribution
    const scoreDistribution = { 0: 0, 25: 0, 50: 0, 75: 0, 100: 0 };
    scores.forEach(score => {
      if (score <= 25) scoreDistribution[0]++;
      else if (score <= 50) scoreDistribution[25]++;
      else if (score <= 75) scoreDistribution[50]++;
      else if (score <= 100) scoreDistribution[75]++;
      else scoreDistribution[100]++;
    });

    return {
      averageScore,
      highestScore,
      lowestScore,
      totalParticipants,
      studentScores: Object.values(studentScores).sort((a, b) => b.totalScore - a.totalScore),
      scoreDistribution
    };
  }, [students, responses]);

  // Export results to CSV
  const exportResults = () => {
    const headers = ["Rank", "Student Name", "Total Score", "Questions Answered", "Correct Answers"];
    const rows = statistics.studentScores.map((student, index) => [
      index + 1,
      student.name,
      student.totalScore,
      student.responses.length,
      student.responses.filter(r => r.is_correct).length
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-results-${gameCode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 text-xl font-semibold">Loading results...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Final Results</h1>
            <p className="text-slate-500 mt-2">
              Game Code: <span className="font-semibold">{gameCode}</span> • 
              {statistics.totalParticipants} participants
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportResults}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition font-semibold"
            >
              Export Results
            </button>
            <button
              onClick={() => navigate("/instructor/dashboard-official")}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Average Score</h3>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 text-sm">📊</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{statistics.averageScore}</p>
            <p className="text-sm text-slate-500 mt-1">points</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Highest Score</h3>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-600 text-sm">🏆</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{statistics.highestScore}</p>
            <p className="text-sm text-slate-500 mt-1">points</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Lowest Score</h3>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-amber-600 text-sm">📈</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{statistics.lowestScore}</p>
            <p className="text-sm text-slate-500 mt-1">points</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Score Distribution Chart */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-6">Score Distribution</h2>
            <div className="space-y-4">
              {Object.entries(statistics.scoreDistribution).map(([range, count]) => {
                const percentage = statistics.totalParticipants > 0 
                  ? Math.round((count / statistics.totalParticipants) * 100)
                  : 0;
                
                return (
                  <div key={range} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {range === 0 ? "0-25" : range === 25 ? "26-50" : range === 50 ? "51-75" : range === 75 ? "76-100" : "100+"} points
                      </span>
                      <span className="text-slate-500">{count} students ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ranked Students */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-6">Ranked Students</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {statistics.studentScores.map((student, index) => (
                <div key={student.name} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{student.name}</p>
                      <p className="text-sm text-slate-500">
                        {student.responses.filter(r => r.is_correct).length} / {student.responses.length} correct
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">{student.totalScore}</p>
                    <p className="text-sm text-slate-500">points</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance by Difficulty */}
        <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-6">Performance by Difficulty</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {["easy", "medium", "hard"].map((difficulty) => {
              const difficultyQuestions = Object.values(questionsByDifficulty[difficulty] || []);
              const difficultyResponses = responses.filter(r => {
                const question = difficultyQuestions.find(q => q.id === r.question_id);
                return question;
              });
              
              const correctAnswers = difficultyResponses.filter(r => r.is_correct).length;
              const totalAnswers = difficultyResponses.length;
              const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

              return (
                <div key={difficulty} className="text-center p-6 rounded-xl border border-slate-200 bg-slate-50">
                  <h3 className="text-lg font-bold capitalize mb-2">{difficulty}</h3>
                  <p className="text-3xl font-bold text-slate-900 mb-2">{accuracy}%</p>
                  <p className="text-sm text-slate-500">
                    {correctAnswers} / {totalAnswers} correct
                  </p>
                  <div className="mt-4 w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full"
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstructorFinalResults;
