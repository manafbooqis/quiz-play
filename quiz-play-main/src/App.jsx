import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import JoinGame from "./pages/student/JoinGame";
import Lobby from "./pages/student/Lobby";
import Difficulty from "./pages/student/Difficulty";
import Question from "./pages/student/Question";
import Result from "./pages/student/Result";
import FinalResults from "./pages/student/FinalResults";

import DashboardOfficial from "./pages/instructor/DashboardOfficial";
import SessionOfficial from "./pages/instructor/SessionOfficial";
import QuestionsPreview from "./pages/instructor/questions-preview";  

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Student routes */}
        <Route path="/student/join" element={<JoinGame />} />
        <Route path="/student/lobby" element={<Lobby />} />
        <Route path="/student/difficulty" element={<Difficulty />} />
        <Route path="/student/question" element={<Question />} />
        <Route path="/student/result" element={<Result />} />
        <Route path="/student/final-results" element={<FinalResults />} />

        {/* Instructor routes */}
        <Route path="/instructor/dashboard-official" element={<DashboardOfficial />} />
        <Route path="/instructor/session-official" element={<SessionOfficial />} />
        <Route path="/instructor/questions-preview" element={<QuestionsPreview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;