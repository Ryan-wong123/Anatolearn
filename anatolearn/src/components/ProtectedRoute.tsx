import { Navigate, Outlet } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

function hasUnexpiredPayload(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export default function ProtectedRoute() {
  const { token } = useAppContext();

  if (!token || !hasUnexpiredPayload(token)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
