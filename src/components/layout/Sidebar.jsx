import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
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
  
  if (!user) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">FollowTrack</h1>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}
            >
              <Icon size={20} className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">{getInitials(user.name)}</div>
          <div className="user-info">
            <p className="user-name">{user.name}</p>
          </div>
        </div>
        <button onClick={() => logoutUser()} className="logout-btn">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
