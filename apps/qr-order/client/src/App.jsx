import { Routes, Route } from 'react-router-dom';
import TableOrderApp from './pages/TableOrderApp.jsx';

function MissingLink() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600 px-6 text-center">
      <p>Open the QR code on your table — the link should include the venue and table.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/:tenantId/:storeId/:tableId" element={<TableOrderApp />} />
      <Route path="*" element={<MissingLink />} />
    </Routes>
  );
}
