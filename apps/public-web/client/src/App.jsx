import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import SignupBusinessPage from './pages/SignupBusinessPage';
import SignupCompletePage from './pages/SignupCompletePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/business" element={<SignupBusinessPage />} />
        <Route path="/signup/complete" element={<SignupCompletePage />} />
      </Routes>
    </BrowserRouter>
  );
}
