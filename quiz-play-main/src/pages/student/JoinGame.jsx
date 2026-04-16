import { useState } from "react";
import { useNavigate } from "react-router-dom";

function JoinGame() {
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState("");
  const [gameCode, setGameCode] = useState("");

  const [nameError, setNameError] = useState("");
  const [codeError, setCodeError] = useState("");

  function handleJoin() {
    let hasError = false;

    setNameError("");
    setCodeError("");

    const name = studentName.trim();
    const code = gameCode.trim();

    if (!name) {
      setNameError("Please enter your name.");
      hasError = true;
    }

    if (!code) {
      setCodeError("Please enter the game code.");
      hasError = true;
    }

    if (hasError) return;

    navigate("/student/lobby", {
      state: { studentName: name, gameCode: code },
    });
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-8">
        <h1 className="game-font text-3xl text-cyan-300 text-center mb-6">
          Join Game
        </h1>

        <p className="text-slate-300 text-center mb-8">
          Enter your name and the game code to join the live quiz.
        </p>

        <div className="mb-4">
          <label className="block mb-2 text-sm text-slate-300">
            Student Name
          </label>
          <input
            type="text"
            placeholder="Enter your name"
            value={studentName}
            onChange={(e) => {
              setStudentName(e.target.value);
              if (nameError) setNameError("");
            }}
            className={`w-full px-4 py-3 rounded-xl bg-slate-700 border text-white outline-none focus:ring-2 ${
              nameError
                ? "border-red-400 focus:ring-red-400"
                : "border-slate-500 focus:ring-cyan-400"
            }`}
          />
          {nameError && <p className="mt-2 text-sm text-red-400">{nameError}</p>}
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-slate-300">Game Code</label>
          <input
            type="text"
            placeholder="Enter game code"
            value={gameCode}
            onChange={(e) => {
              setGameCode(e.target.value);
              if (codeError) setCodeError("");
            }}
            className={`w-full px-4 py-3 rounded-xl bg-slate-700 border text-white outline-none focus:ring-2 ${
              codeError
                ? "border-red-400 focus:ring-red-400"
                : "border-slate-500 focus:ring-cyan-400"
            }`}
          />
          {codeError && <p className="mt-2 text-sm text-red-400">{codeError}</p>}
        </div>

        <button
          onClick={handleJoin}
          className="w-full game-font bg-cyan-500 hover:bg-cyan-400 text-slate-900 py-3 rounded-xl transition"
        >
          Join
        </button>
      </div>
    </div>
  );
}

export default JoinGame;