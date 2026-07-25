import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Viewer from './pages/Viewer';
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
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/3dviewer" element={<ModelGallery />} />
              <Route path="/3dviewer/:modelId" element={<Viewer />} />
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