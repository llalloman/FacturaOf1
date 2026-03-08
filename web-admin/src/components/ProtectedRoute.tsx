import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Guard: email must be verified before accessing the main app
  if (user && !user.email_verificado) {
    return <Navigate to="/verificar-email" replace />;
  }

  // Guard: onboarding must be complete before accessing the main app
  if (user && !user.onboarding_completado) {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowedRoles && user?.rol && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
