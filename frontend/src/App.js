import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/shared/ErrorBoundary';
import './index.css';
import './i18n';

import Layout from './components/shared/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ComplaintsPage from './pages/ComplaintsPage';
import ComplaintDetail from './pages/ComplaintDetail';
import SubmitComplaint from './pages/SubmitComplaint';
import CMDashboard from './pages/CMDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import OfficersPage from './pages/OfficersPage';
import VisitsPage from './pages/VisitsPage';
import AuditPage from './pages/AuditPage';
import DepartmentsPage from './pages/DepartmentsPage';
import DepartmentDetailPage from './pages/DepartmentDetailPage';
import OfficerDetailPage from './pages/OfficerDetailPage';
import SentimentPage from './pages/SentimentPage';
import AIFraudPage from './pages/AIFraudPage';
import MapView from './pages/MapView';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import NotFound from './pages/NotFound';
import TrackComplaint from './pages/TrackComplaint';
import CommandPalette from './components/shared/CommandPalette';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';

const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const RoleRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'super_admin') return <Navigate to="/super-admin-dashboard" replace />;
  if (user?.role === 'cm') return <Navigate to="/cm-dashboard" replace />;
  if (user?.role === 'department_head') return <Navigate to="/department-dashboard" replace />;
  if (user?.role === 'employee') return <Navigate to="/my-complaints" replace />;
  return <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/track" element={<TrackComplaint />} />
      <Route path="/track/:ticketId" element={<TrackComplaint />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<RoleRouter />} />
        <Route path="dashboard" element={<PrivateRoute roles={['citizen']}><Dashboard /></PrivateRoute>} />
        <Route path="cm-dashboard" element={<PrivateRoute roles={['cm']}><CMDashboard /></PrivateRoute>} />
        <Route path="super-admin-dashboard" element={<PrivateRoute roles={['super_admin']}><SuperAdminDashboard /></PrivateRoute>} />
        <Route path="department-dashboard" element={<PrivateRoute roles={['department_head']}><DepartmentDashboard /></PrivateRoute>} />
        <Route path="my-complaints" element={<PrivateRoute roles={['employee', 'department_head']}><EmployeeDashboard /></PrivateRoute>} />
        <Route path="complaints" element={<PrivateRoute><ComplaintsPage /></PrivateRoute>} />
        <Route path="complaints/new" element={<PrivateRoute roles={['citizen']}><SubmitComplaint /></PrivateRoute>} />
        <Route path="complaints/:id" element={<PrivateRoute><ComplaintDetail /></PrivateRoute>} />
        <Route path="map" element={<PrivateRoute><MapView /></PrivateRoute>} />
        <Route path="officers" element={<PrivateRoute roles={['cm', 'super_admin', 'department_head']}><OfficersPage /></PrivateRoute>} />
        <Route path="officers/:id" element={<PrivateRoute roles={['cm', 'super_admin', 'department_head']}><OfficerDetailPage /></PrivateRoute>} />
        <Route path="users" element={<PrivateRoute roles={['super_admin', 'cm', 'department_head']}><UsersPage /></PrivateRoute>} />
        <Route path="sentiment" element={<PrivateRoute roles={['cm', 'super_admin']}><SentimentPage /></PrivateRoute>} />
        <Route path="fraud-detection" element={<PrivateRoute roles={['cm', 'super_admin']}><AIFraudPage /></PrivateRoute>} />
        <Route path="visits" element={<PrivateRoute roles={['cm', 'super_admin']}><VisitsPage /></PrivateRoute>} />
        <Route path="audit" element={<PrivateRoute roles={['cm', 'super_admin']}><AuditPage /></PrivateRoute>} />
        <Route path="departments" element={<PrivateRoute roles={['super_admin', 'cm']}><DepartmentsPage /></PrivateRoute>} />
        <Route path="departments/:id" element={<PrivateRoute roles={['super_admin', 'cm']}><DepartmentDetailPage /></PrivateRoute>} />
        <Route path="profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <AppRoutes />
              <CommandPalette />
              <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
