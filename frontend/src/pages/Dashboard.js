import React, { useEffect, useState, useCallback } from 'react';
import { listResumes, listJDs, getAnalysis, scoreBulk } from '../api';
import CandidateCard from '../components/CandidateCard';
import { Link } from 'react-router-dom';
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
  const [resumes, setResumes] = useState([]);
  const [jds, setJDs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedJD, setSelectedJD] = useState('');
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jdFromUrl = params.get('jd');
    loadData(jdFromUrl);
  }, []);

  const loadData = async (preselect = null) => {
    try {
      const [rRes, jRes] = await Promise.all([listResumes(), listJDs()]);
      setResumes(rRes.data.resumes || []);
      const jdList = jRes.data.jds || [];
      setJDs(jdList);
      const initial = preselect || (jdList.length ? jdList[0].id : '');
      if (initial) {
        setSelectedJD(initial);
        loadCandidates(initial);
      }
    } catch (e) {
      toast.error('Failed to load data');
    }
  };

  const loadCandidates = useCallback(async (jdId) => {
    if (!jdId) return;
    setLoading(true);
    try {
      const res = await getAnalysis(jdId, { limit: 100 });
      setCandidates(res.data.shortlist || []);
    } catch (e) {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleJDChange = (jdId) => {
    setSelectedJD(jdId);
    setCandidates([]);
    if (jdId) loadCandidates(jdId);
  };

  const handleBulkScore = async () => {
    if (!selectedJD) { toast.error('Select a Job Role first'); return; }
    setBulkLoading(true);
    try {
      const fd = new FormData();
      fd.append('jd_id', selectedJD);
      fd.append('resume_ids', '');
      await scoreBulk(fd);
      toast.success('Analysis started! Refreshing in a moment...');
      setTimeout(() => loadCandidates(selectedJD), 3000);
    } catch (e) {
      toast.error('Analysis failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setBulkLoading(false);
    }
  };

  const selectedJDDoc = jds.find(j => j.id === selectedJD);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Dashboard</h1>
          <p className="page-subtitle">See what your resumes are missing for each role</p>
        </div>
      </div>

      <div className="grid-2 mb-6 animate-fade-up delay-100">
        <StatCard label="Resumes Uploaded" value={resumes.length} icon="📄" color="#6366f1" />
        <StatCard label="Job Roles" value={jds.length} icon="💼" color="#8b5cf6" />
      </div>
      <div className="card mb-6 animate-fade-up delay-200">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">Select Job Role</label>
            <select
              id="jd-select"
              className="form-select"
              value={selectedJD}
              onChange={e => handleJDChange(e.target.value)}
            >
              <option value="">Choose a role...</option>
              {jds.map(jd => (
                <option key={jd.id} value={jd.id}>{jd.title || jd.id}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              id="analyze-all-btn"
              className="btn btn-primary"
              onClick={handleBulkScore}
              disabled={bulkLoading || !selectedJD}
            >
              {bulkLoading ? '⟳ Analyzing...' : '🔍 Analyze All Resumes'}
            </button>
            <button
              id="refresh-btn"
              className="btn btn-secondary"
              onClick={() => loadCandidates(selectedJD)}
              disabled={!selectedJD || loading}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
        {selectedJDDoc?.required_skills?.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Required skills for this role
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedJDDoc.required_skills.map(s => (
                <span key={s} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            🔍 Gap Analysis
          </h2>
          {candidates.length > 0 && (
            <span className="badge badge-neutral">{candidates.length} candidates analyzed</span>
          )}
        </div>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
            <span>Analyzing candidates...</span>
          </div>
        ) : candidates.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {candidates.map(c => (
              <CandidateCard
                key={c.resume_id || c.id}
                candidate={c}
                jdId={selectedJD}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state card">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">
              {!selectedJD ? 'Select a Job Role' : 'No analysis yet'}
            </div>
            <div className="empty-state-desc">
              {!selectedJD
                ? 'Choose a job role above to see the gap analysis for your resumes.'
                : 'Click "Analyze All Resumes" to see what each resume is missing for this role.'}
            </div>
            {!selectedJD && jds.length === 0 && (
              <Link to="/data-studio" className="btn btn-primary" style={{ marginTop: 16 }}>
                🗂️ Upload Job Descriptions
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
