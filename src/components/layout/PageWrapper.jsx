import React from 'react';
import { Sidebar } from './Sidebar';
import './layout.css';

export function PageWrapper({ children, title, action }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {(title || action) && (
          <header className="page-header animate-fade-up">
            <h2 className="page-title">{title}</h2>
            {action && <div className="page-action">{action}</div>}
          </header>
        )}
        <div className="page-body animate-fade-up animate-fade-up-delay-1">
          {children}
        </div>
      </main>
    </div>
  );
}
