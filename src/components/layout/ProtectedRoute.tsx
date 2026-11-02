import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';
import type { PerfilUsuario } from '@/types';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: PerfilUsuario[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.perfil)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Acesso negado</h1>
          <p className="text-slate-500 mt-2">
            Seu perfil ({user.perfil}) não tem permissão para esta página.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
