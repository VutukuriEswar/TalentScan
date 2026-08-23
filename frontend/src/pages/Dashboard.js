import React, { useEffect, useState, useCallback } from 'react';
import { listResumes, listJDs, getShortlist, scoreResume, scoreBulk, healthCheck } from '../api';
import CandidateCard from '../components/CandidateCard';
import WeightSimulator from '../components/WeightSimulator';
import ExportButtons from '../components/ExportButtons';
import toast from 'react-hot-toast';

function StatCard({ label, value, icon, color = 'var(--brand-primary)' }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{icon} {label}</div>
      <div className="stat-value" style={{ backgroundImage: `linear-gradient(135deg, ${color}, var(--brand-accent))` }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function Dashboard() {
  const [resumes, setResumes]     = useState([]);
  const [jds, setJDs]             = useState([]);
  const [shortlist, setShortlist] = useState([]);
  const [selectedJD, setSelectedJD] = useState('');
  const [sortBy, setSortBy]       = useState('score');
  const [minScore, setMinScore]   = useState(0);
  const [loading, setLoading]     = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [status, setStatus]       = useState(null);

  useEffect(() => {
    loadData();
    healthCheck().then(r => setStatus(r.data)).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const [rRes, jRes] = await Promise.all([listResumes(), listJDs()]);
      setResumes(rRes.data.resumes || []);
      setJDs(jRes.data.jds || []);
      if (jRes.data.jds?.length) {
        const firstJD = jRes.data.jds[0].id;
        setSelectedJD(firstJD);
        loadShortlist(firstJD);
      }
    } catch (e) {
      toast.error('Failed to load data');
    }
  };

  const loadShortlist = useCallback(async (jdId, sort = 'score', min = 0) => {
    if (!jdId) return;
    setLoading(true);
    try {
      const res = await getShortlist(jdId, { sort_by: sort, min_score: min, limit: 50 });
      setShortlist(res.data.shortlist || []);
    } catch (e) {
      toast.error('Failed to load shortlist');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleJDChange = (jdId) => {
    setSelectedJD(jdId);
    setShortlist([]);
    if (jdId) loadShortlist(jdId, sortBy, minScore);
  };

  const handleBulkScore = async () => {
    if (!selectedJD) { toast.error('Select a JD first'); return; }
    setBulkLoading(true);
    try {
      const fd = new FormData();
      fd.append('jd_id', selectedJD);
      fd.append('resume_ids', '');
      await scoreBulk(fd);
      toast.success('Bulk scoring started in background! Refresh in a moment.');
      setTimeout(() => loadShortlist(selectedJD, sortBy, minScore), 3000);
    } catch (e) {
      toast.error('Bulk score failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleScoreOne = async (resumeId) => {
    if (!selectedJD) { toast.error('Select a JD first'); return; }
    const fd = new FormData();
    fd.append('resume_id', resumeId);
    fd.append('jd_id', selectedJD);
    try {
      await scoreResume(fd);
      toast.success('Scored! Refreshing...');
      loadShortlist(selectedJD, sortBy, minScore);
    } catch (e) {
      toast.error('Score failed');
    }
  };

  const avgScore = shortlist.length
    ? (shortlist.reduce((s, c) => s + (c.score || 0), 0) / shortlist.length).toFixed(1)
    : null;

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">📊 Dashboard</h1>
          <p className="page-subtitle">AI-powered candidate shortlisting and ranking</p>
        </div>
        {status && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${status.mongodb === 'connected' ? 'badge-success' : 'badge-danger'}`}>
              🗄️ MongoDB {status.mongodb}
            </span>
            <span className={`badge ${status.llm_configured ? 'badge-primary' : 'badge-neutral'}`}>
              🤖 LLM {status.llm_configured ? 'ready' : 'offline — TF-IDF mode'}
            </span>
            <span className="badge badge-info">🧮 {status.faiss_vectors} embeddings</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid-4 mb-6">
        <StatCard label="Resumes"     value={resumes.length}     icon="📄" color="#6366f1" />
        <StatCard label="Job Roles"   value={jds.length}         icon="💼" color="#8b5cf6" />
        <StatCard label="Shortlisted" value={shortlist.length}   icon="⭐" color="#06b6d4" />
        <StatCard label="Avg Score"   value={avgScore}           icon="🎯" color="#10b981" />
      </div>

      {/* Controls */}
      <div className="card mb-6">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">Job Description</label>
            <select
              id="jd-select"
              className="form-select"
              value={selectedJD}
              onChange={e => handleJDChange(e.target.value)}
            >
              <option value="">Select a JD...</option>
              {jds.map(jd => (
                <option key={jd.id} value={jd.id}>{jd.title || jd.id}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 150, marginBottom: 0 }}>
            <label className="form-label">Sort By</label>
            <select id="sort-select" className="form-select" value={sortBy} onChange={e => {
              setSortBy(e.target.value);
              loadShortlist(selectedJD, e.target.value, minScore);
            }}>
              <option value="score">Overall Score</option>
              <option value="skills_score">Skills Match</option>
              <option value="experience_score">Experience</option>
              <option value="education_score">Education</option>
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 150, marginBottom: 0 }}>
            <label className="form-label">Min Score: {minScore}</label>
            <input
              id="min-score-slider"
              type="range" min="0" max="9" step="0.5" value={minScore}
              onChange={e => { setMinScore(Number(e.target.value)); loadShortlist(selectedJD, sortBy, Number(e.target.value)); }}
              style={{ width: '100%', marginTop: 6 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              id="bulk-score-btn"
              className="btn btn-primary"
              onClick={handleBulkScore}
              disabled={bulkLoading || !selectedJD}
            >
              {bulkLoading ? '⟳ Scoring...' : '🚀 Score All Resumes'}
            </button>
            <button
              id="refresh-shortlist-btn"
              className="btn btn-secondary"
              onClick={() => loadShortlist(selectedJD, sortBy, minScore)}
              disabled={!selectedJD || loading}
            >
              🔄 Refresh
            </button>
            <ExportButtons jdId={selectedJD} minScore={minScore} />
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Shortlist */}
        <div>
          {loading ? (
            <div className="loading-overlay">
              <div className="spinner" />
              <span>Loading shortlist...</span>
            </div>
          ) : shortlist.length > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontWeight: 700 }}>
                  Shortlisted Candidates
                  <span className="badge badge-primary" style={{ marginLeft: 10 }}>{shortlist.length}</span>
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {shortlist.map(c => (
                  <CandidateCard
                    key={c.resume_id || c.id}
                    candidate={c}
                    jdId={selectedJD}
                    onScore={handleScoreOne}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state card">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No scored candidates</div>
              <div className="empty-state-desc">
                {selectedJD
                  ? 'Click "Score All Resumes" to start AI-based ranking.'
                  : 'Upload resumes and a job description, then come back here.'}
              </div>
              {!selectedJD && (
                <a href="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>📤 Go to Upload</a>
              )}
            </div>
          )}
        </div>

        {/* Weight Simulator */}
        <div style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
          <WeightSimulator jdId={selectedJD} initialData={shortlist} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
