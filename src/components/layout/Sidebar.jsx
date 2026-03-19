import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { logoutUser } from '../../lib/auth';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ClipboardList,
  MessageSquare,
  LogOut
} from 'lucide-react';
import { ROUTES } from '../../router/routes';
import './layout.css';

const navItems = [
  { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: 'My Students', path: ROUTES.MY_STUDENTS, icon: Users },
  { label: 'Attendance', path: ROUTES.ATTENDANCE, icon: CalendarCheck },
  { label: 'Assignments', path: ROUTES.ASSIGNMENTS, icon: ClipboardList },
  { label: 'Follow-Up Logger', path: ROUTES.FOLLOW_UP, icon: MessageSquare },
];

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export function Sidebar() {
  const { user } = useAuthStore();
  const { sidebarOpen, closeSidebar } = useUIStore();
  const location = useLocation();

  useEffect(() => {
    closeSidebar();
  }, [location.pathname]);
  
  if (!user) return null;

  return (
    <>
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={closeSidebar}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ height: '32px' }}></div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={20} className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{getInitials(user.name)}</div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user.name}</p>
          </div>
        </div>
        <button onClick={() => logoutUser()} className="sidebar-signout-btn">
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
    </>
  );
}
