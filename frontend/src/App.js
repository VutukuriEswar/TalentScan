import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Analytics from './pages/Analytics';
import Chat from './pages/Chat';
import CandidateDetail from './pages/CandidateDetail';
import JDManager from './pages/JDManager';
import AuditLog from './pages/AuditLog';

const NAV_ITEMS = [
  { to: '/',         icon: '📊', label: 'Dashboard'   },
  { to: '/upload',   icon: '📤', label: 'Upload'       },
  { to: '/jd',       icon: '📋', label: 'JD Manager'  },
  { to: '/analytics',icon: '📈', label: 'Analytics'    },
  { to: '/chat',     icon: '💬', label: 'AI Chat'      },
  { to: '/audit',    icon: '🔍', label: 'Audit Log'    },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🎯</div>
        <span className="sidebar-logo-text">TalentScan</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          TalentScan v1.0 · AI Resume Screener
        </div>
      </div>
    </aside>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/upload"        element={<Upload />} />
            <Route path="/jd"            element={<JDManager />} />
            <Route path="/analytics"     element={<Analytics />} />
            <Route path="/chat"          element={<Chat />} />
            <Route path="/audit"         element={<AuditLog />} />
            <Route path="/candidate/:id" element={<CandidateDetail />} />
          </Routes>
        </main>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: 'white' } },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
