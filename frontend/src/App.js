import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import DataStudio from './pages/DataStudio';
import Analytics from './pages/Analytics';
import Chat from './pages/Chat';
import CandidateDetail from './pages/CandidateDetail';

const NAV_ITEMS = [
  { to: '/',         icon: '📊', label: 'Dashboard'   },
  { to: '/data-studio', icon: '🗂️', label: 'Data Studio' },
  { to: '/analytics',icon: '📈', label: 'Analytics'    },
  { to: '/chat',     icon: '💬', label: 'AI Chat'      },
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

function NotFound() {
  return (
    <div className="empty-state" style={{ height: '80vh' }}>
      <div className="empty-state-icon" style={{ fontSize: '4rem' }}>404</div>
      <div className="empty-state-title" style={{ fontSize: '1.5rem', marginTop: 16 }}>Page Not Found</div>
      <div className="empty-state-desc">The page you're looking for doesn't exist or has been moved.</div>
    </div>
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
            <Route path="/data-studio"   element={<DataStudio />} />
            <Route path="/analytics"     element={<Analytics />} />
            <Route path="/chat"          element={<Chat />} />
            <Route path="/candidate/:id" element={<CandidateDetail />} />
            <Route path="*"              element={<NotFound />} />
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
