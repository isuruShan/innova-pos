import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import SignupBusinessPage from './pages/SignupBusinessPage';
import SignupCompletePage from './pages/SignupCompletePage';
import MerchantGuideIndex from './pages/MerchantGuideIndex';
import MerchantGuideTopicPage from './pages/MerchantGuideTopicPage';
import CustomerCheckin from './pages/CustomerCheckin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/business" element={<SignupBusinessPage />} />
        <Route path="/signup/complete" element={<SignupCompletePage />} />
        <Route path="/merchant-guide" element={<MerchantGuideIndex />} />
        <Route path="/merchant-guide/:slug" element={<MerchantGuideTopicPage />} />
        <Route path="/customer-checkin" element={<CustomerCheckin />} />
      </Routes>
    </BrowserRouter>
  );
}
