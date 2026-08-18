import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Landing from './modules/landing/Landing';
import Planning from './modules/planner/Planning';
import TripPage from './modules/trip/TripPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/trip/:tripId" element={<TripPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
