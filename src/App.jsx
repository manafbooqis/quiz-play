import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";

import JoinGame from "./pages/student/JoinGame";
import Lobby from "./pages/student/Lobby";
import Difficulty from "./pages/student/Difficulty";
import Question from "./pages/student/Question";
import FinalResults from "./pages/student/FinalResults";
import WaitingForOthers from "./pages/student/WaitingForOthers";
import RoundResults from "./pages/student/RoundResults";

import DashboardOfficial from "./pages/instructor/DashboardOfficial";
import SessionOfficial from "./pages/instructor/SessionOfficial";
import QuestionsPreview from "./pages/instructor/questions-preview";
import LoginTeacher from "./pages/instructor/LoginTeacher";
import RegisterTeacher from "./pages/instructor/RegisterTeacher";
import InstructorLiveQuiz from "./pages/instructor/InstructorLiveQuiz";
import InstructorFinalResults from "./pages/instructor/InstructorFinalResults";
import InstructorScoreDistribution from "./pages/instructor/InstructorScoreDistribution";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/student/join" element={<JoinGame />} />
        <Route path="/student/lobby" element={<Lobby />} />
        <Route path="/student/difficulty" element={<Difficulty />} />
        <Route path="/student/question" element={<Question />} />
        <Route path="/student/final-results" element={<FinalResults />} />
        <Route path="/student/waiting-for-others" element={<WaitingForOthers />} />
        <Route path="/student/round-results" element={<RoundResults />} />

        <Route path="/instructor/login" element={<LoginTeacher />} />
        <Route path="/instructor/register" element={<RegisterTeacher />} />
        <Route path="/instructor/dashboard-official" element={<DashboardOfficial />} />
        <Route path="/instructor/session-official" element={<SessionOfficial />} />
        <Route path="/instructor/questions-preview" element={<QuestionsPreview />} />
        <Route path="/instructor/live-quiz" element={<InstructorLiveQuiz />} />
        <Route path="/instructor/final-results" element={<InstructorFinalResults />} />
        <Route path="/instructor/score-distribution" element={<InstructorScoreDistribution />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
