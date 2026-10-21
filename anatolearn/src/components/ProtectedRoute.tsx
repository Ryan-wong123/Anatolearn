import { Navigate, Outlet } from 'react-router-dom';
import { useAppContext } from '../context/AppContextState';

export default function ProtectedRoute() {
  const { token } = useAppContext();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
