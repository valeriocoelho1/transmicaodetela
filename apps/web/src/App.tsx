import { Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { HostPage } from './pages/HostPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ViewerPage } from './pages/ViewerPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/host/:roomId" element={<HostPage />} />
      <Route path="/r/:roomId" element={<ViewerPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
