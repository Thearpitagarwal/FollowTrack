import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from './routes';
import { ProtectedRoute } from './ProtectedRoute';

// Auth
import { Login } from '../pages/auth/Login';

// Layout
import { Sidebar } from '../components/layout/Sidebar';

// Teacher & Shared Pages
import { Dashboard } from '../pages/teacher/Dashboard';
import { MyStudents } from '../pages/teacher/MyStudents';
import { Attendance } from '../pages/teacher/Attendance';
import { Assignments } from '../pages/teacher/Assignments';
import { FollowUpLogger } from '../pages/teacher/FollowUpLogger';
import { StudentProfile } from '../pages/shared/StudentProfile';
import { SeedPage } from '../pages/admin/SeedPage';

// Layout wrapper — renders Sidebar + content
function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--color-warm-white, #FAF8F5)' }}>
        <Outlet />
      </main>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.LOGIN} replace />} />
        <Route path={ROUTES.LOGIN} element={<Login />} />

        {/* All protected routes inside layout */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
          <Route path={ROUTES.MY_STUDENTS} element={<MyStudents />} />
          <Route path={ROUTES.ATTENDANCE} element={<Attendance />} />
          <Route path={ROUTES.ASSIGNMENTS} element={<Assignments />} />
          <Route path={ROUTES.FOLLOW_UP} element={<FollowUpLogger />} />
          <Route path={ROUTES.STUDENT_PROFILE} element={<StudentProfile />} />
          <Route path="/admin/seed" element={<SeedPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
