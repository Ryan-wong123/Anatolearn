import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContextState';

export default function ProtectedRoute({ role }: { role?: 'teacher' | 'student' }) {
  const { user } = useAppContext();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
