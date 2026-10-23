import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Layout from './components/Layout';
import RouteAnnouncement from './components/RouteAnnouncement';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';

// Every page after sign-in loads on demand so the first visit downloads only what it needs (the 3D viewer is the heaviest).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Viewer = lazy(() => import('./pages/Viewer'));
const ModelGallery = lazy(() => import('./pages/ModelGallery'));
const Videos = lazy(() => import('./pages/Videos'));
const VideoPlayer = lazy(() => import('./pages/VideoPlayer'));
const Quizzes = lazy(() => import('./pages/Quizzes'));
const Library = lazy(() => import('./pages/Library'));
const Profile = lazy(() => import('./pages/Profile'));
const Search = lazy(() => import('./pages/Search'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Users = lazy(() => import('./pages/Users'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <ErrorBoundary>
    <AppProvider>
      <ToastProvider>
      <ConfirmProvider>
      <BrowserRouter>
        <RouteAnnouncement />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/3dviewer" element={<ModelGallery />} />
              <Route path="/3dviewer/:modelId" element={<Viewer />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/videos/:videoId" element={<VideoPlayer />} />
              <Route path="/quizzes" element={<Quizzes />} />
              <Route path="/library" element={<Library />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/search" element={<Search />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route element={<ProtectedRoute role="teacher" />}>
                <Route path="/admin/users" element={<Users />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound standalone />} />
        </Routes>
      </BrowserRouter>
      </ConfirmProvider>
      </ToastProvider>
    </AppProvider>
    </ErrorBoundary>
  );
}
