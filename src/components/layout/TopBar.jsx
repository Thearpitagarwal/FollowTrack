import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { ROUTES } from '../../router/routes';
import { useAuthStore } from '../../store/authStore';

export function TopBar() {
  const { toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const location = useLocation();

  // Determine page title based on current route
  let pageTitle = 'Dashboard';
  if (location.pathname === ROUTES.MY_STUDENTS) pageTitle = 'My Students';
  if (location.pathname === ROUTES.ATTENDANCE) pageTitle = 'Attendance';
  if (location.pathname === ROUTES.ASSIGNMENTS) pageTitle = 'Assignments';
  if (location.pathname === ROUTES.FOLLOW_UP) pageTitle = 'Follow Up Logger';
  if (location.pathname.startsWith('/students')) pageTitle = 'Student Profile';

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button className="hamburger-btn" onClick={toggleSidebar} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <span className="top-bar-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 600 }}>{pageTitle}</span>
      </div>
      
      {/* Right side: user avatar (optional on mobile, but keeping for design consistency) */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* We can place extra tools like notifications here in the future */}
        </div>
      )}
    </header>
  );
}
