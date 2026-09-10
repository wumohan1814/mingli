import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import WaitingPage from './pages/WaitingPage';
import CalibrationPage from './pages/CalibrationPage';
import ResultPage from './pages/ResultPage';
import RevisePage from './pages/RevisePage';
import ArchivePage from './pages/ArchivePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/case/:caseId/waiting" element={<WaitingPage />} />
      <Route path="/case/:caseId/calibration" element={<CalibrationPage />} />
      <Route path="/case/:caseId/result" element={<ResultPage />} />
      <Route path="/case/:caseId/revise" element={<RevisePage />} />
      <Route path="/archive" element={<ArchivePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
