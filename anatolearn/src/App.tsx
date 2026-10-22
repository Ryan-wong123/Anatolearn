import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Layout from './components/Layout';
import RouteAnnouncement from './components/RouteAnnouncement';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
const Viewer = lazy(() => import('./pages/Viewer'));
import ModelGallery from './pages/ModelGallery';
import Videos from './pages/Videos';
import Quizzes from './pages/Quizzes';
import Library from './pages/Library';
import VideoPlayer from './pages/VideoPlayer';

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
      <ConfirmProvider>
      <BrowserRouter>
        <RouteAnnouncement />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/3dviewer" element={<ModelGallery />} />
              <Route path="/3dviewer/:modelId" element={<Suspense fallback={<p role="status" className="p-6 text-slate-600 dark:text-slate-300">Loading 3D viewer…</p>}><Viewer /></Suspense>} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/videos/:videoId" element={<VideoPlayer />} />
              <Route path="/quizzes" element={<Quizzes />} />
              <Route path="/library" element={<Library />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      </ConfirmProvider>
      </ToastProvider>
    </AppProvider>
  );
}
