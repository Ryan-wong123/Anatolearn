import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContextState';
import type { Role } from '../context/AppContextState';

// `role` limits a route to one role or a list of roles. Anyone else goes to the home page for their own role.
export default function ProtectedRoute({ role }: { role?: Role | Role[] }) {
  const { user } = useAppContext();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  // Staff who still have to enrol in two-factor authentication can only reach their profile, where setup lives.
  if (user.mfa_setup_required && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }
  if (role && !(Array.isArray(role) ? role : [role]).includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin/users' : '/dashboard'} replace />;
  }

  return <Outlet />;
}
