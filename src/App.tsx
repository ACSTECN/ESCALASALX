import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { CalendarioPage } from '@/pages/CalendarioPage';
import { MetasPage } from '@/pages/MetasPage';
import { CondutoresPage } from '@/pages/CondutoresPage';
import { GruposPage } from '@/pages/GruposPage';
import { RotasFixasPage } from '@/pages/RotasFixasPage';
import { EscalaAmanhaPage } from '@/pages/EscalaAmanhaPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CidadesHubsPage } from '@/pages/CidadesHubsPage';
import { HistoricoPage } from '@/pages/HistoricoPage';
import { ConfiguracoesPage } from '@/pages/ConfiguracoesPage';
import { ListaEsperaPage } from '@/pages/ListaEsperaPage';
import { InteresseEntregadorPage } from '@/pages/InteresseEntregadorPage';
import { MensagensMagalogPage } from '@/pages/MensagensMagalogPage';
import { useInitAuth } from '@/hooks/useAuth';
import { features } from '@/lib/branding';

function AppRoutes() {
  useInitAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/entregador" element={<InteresseEntregadorPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CalendarioPage />} />
        <Route
          path="metas"
          element={
            <ProtectedRoute roles={['admin', 'supervisor']}>
              <MetasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="condutores"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'operador']}>
              <CondutoresPage />
            </ProtectedRoute>
          }
        />
        <Route path="escala-amanha" element={<EscalaAmanhaPage />} />
        <Route
          path="grupos"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'operador']}>
              <GruposPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="rotas"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'operador']}>
              <RotasFixasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="lista-espera"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'operador', 'visualizador']}>
              <ListaEsperaPage />
            </ProtectedRoute>
          }
        />
        {features.gmail && (
          <Route
            path="mensagens"
            element={
              <ProtectedRoute roles={['admin', 'supervisor', 'operador', 'visualizador']}>
                <MensagensMagalogPage />
              </ProtectedRoute>
            }
          />
        )}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'operador', 'visualizador']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="cidades-hubs"
          element={
            <ProtectedRoute roles={['admin', 'operador']}>
              <CidadesHubsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="historico"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'operador']}>
              <HistoricoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="configuracoes"
          element={
            <ProtectedRoute roles={['admin']}>
              <ConfiguracoesPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
