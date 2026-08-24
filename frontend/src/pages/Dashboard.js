import React, { useEffect, useState, useCallback } from 'react';
import { listResumes, listJDs, getAnalysis, analyzeResume } from '../api';
import CandidateCard from '../components/CandidateCard';
import { Link, useNavigate } from 'react-router-dom';
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
  const [scores, setScores] = useState([]);
  const [selectedJD, setSelectedJD] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [selectedResume, setSelectedResume] = useState('');
  const navigate = useNavigate();

  const loadScores = useCallback(async (jdId) => {
    if (!jdId) return;
    setLoading(true);
    try {
      const res = await getAnalysis(jdId, { limit: 100 });
      setScores(res.data.shortlist || []);
    } catch (e) {
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(async (preselect = null) => {
    try {
      const [rRes, jRes] = await Promise.all([listResumes(), listJDs()]);
      setResumes(rRes.data.resumes || []);
      const jdList = jRes.data.jds || [];
      setJDs(jdList);
      const initial = preselect || (jdList.length ? jdList[0].id : '');
      if (initial) {
        setSelectedJD(initial);
        loadScores(initial);
      }
    } catch (e) {
      toast.error('Failed to load data');
    }
  }, [loadScores]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jdFromUrl = params.get('jd');
    loadData(jdFromUrl);
  }, [loadData]);

  const handleJDChange = (jdId) => {
    setSelectedJD(jdId);
    setScores([]);
    if (jdId) loadScores(jdId);
  };

  const handleAnalyze = async (resumeId) => {
    if (!selectedJD) return;
    setAnalyzingId(resumeId);
    try {
      await analyzeResume(resumeId, selectedJD);
      toast.success('✅ Analysis complete!');
      await loadScores(selectedJD);
    } catch (e) {
      toast.error('Analysis failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAnalyzeSelected = async () => {
    if (!selectedJD || !selectedResume) return;
    setAnalyzingId(selectedResume);
    try {
      await analyzeResume(selectedResume, selectedJD);
      toast.success('✅ Analysis complete!');
      navigate(`/candidate/${selectedResume}`);
    } catch (e) {
      toast.error('Analysis failed: ' + (e.response?.data?.detail || e.message));
      setAnalyzingId(null);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!selectedJD) return;

    const unanalyzed = resumes.filter(r => !scores.find(s => s.resume_id === r.id));
    if (unanalyzed.length === 0) {
      toast.success('All resumes are already analyzed!');
      return;
    }

    setBulkAnalyzing(true);
    let successCount = 0;

    for (const r of unanalyzed) {
      setAnalyzingId(r.id);
      try {
        await analyzeResume(r.id, selectedJD);
        successCount++;
      } catch (e) {
        toast.error(`Analysis failed for ${r.filename || r.candidate_name}`);
      }
    }

    setAnalyzingId(null);
    setBulkAnalyzing(false);

    if (successCount > 0) {
      toast.success(`✅ Analyzed ${successCount} resume(s)!`);
      loadScores(selectedJD);
    }
  };

  const displayCandidates = resumes.map(r => {
    const scoreDoc = scores.find(s => s.resume_id === r.id);
    return scoreDoc ? { ...scoreDoc, id: scoreDoc.resume_id } : r;
  });

  displayCandidates.sort((a, b) => {
    const scoreA = a.score != null ? a.score : -1;
    const scoreB = b.score != null ? b.score : -1;
    return scoreB - scoreA;
  });

  const analyzedCount = scores.length;
  const notAnalyzed = resumes.length - analyzedCount;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Dashboard</h1>
          <p className="page-subtitle">View and analyze candidates for your job roles</p>
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

          {selectedJD && resumes.length > 0 && (
            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <label className="form-label">Select Resume</label>
              <select
                className="form-select"
                value={selectedResume}
                onChange={e => setSelectedResume(e.target.value)}
              >
                <option value="">Choose a resume...</option>
                {resumes.map(r => (
                  <option key={r.id} value={r.id}>{r.candidate_name || r.filename}</option>
                ))}
              </select>
            </div>
          )}

          {selectedJD && selectedResume && (
            <button
              className="btn btn-primary"
              onClick={handleAnalyzeSelected}
              disabled={loading || bulkAnalyzing || analyzingId}
            >
              {analyzingId === selectedResume ? '⟳ Analyzing...' : '🤖 Analyze Selected'}
            </button>
          )}

          <button
            id="refresh-btn"
            className="btn btn-secondary"
            onClick={() => loadScores(selectedJD)}
            disabled={!selectedJD || loading || bulkAnalyzing || analyzingId}
          >
            🔄 Refresh
          </button>
        </div>

        {selectedJD && resumes.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {analyzedCount > 0
                ? `${analyzedCount} of ${resumes.length} resume${resumes.length !== 1 ? 's' : ''} analyzed for this role`
                : `${resumes.length} resume${resumes.length !== 1 ? 's' : ''} uploaded — none analyzed for this role yet`}
            </div>

            {notAnalyzed > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAnalyzeAll}
                disabled={bulkAnalyzing || !!analyzingId}
              >
                {bulkAnalyzing ? '⟳ Analyzing...' : `🤖 Analyze All Un-analyzed (${notAnalyzed})`}
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>🔍 Analysis Results</h2>
          {resumes.length > 0 && selectedJD && (
            <span className="badge badge-neutral">{resumes.length} total candidates</span>
          )}
        </div>

        {loading && !analyzingId && !bulkAnalyzing ? (
          <div className="loading-overlay">
            <div className="spinner" />
            <span>Loading results...</span>
          </div>
        ) : displayCandidates.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {displayCandidates.map(c => (
              <CandidateCard
                key={c.id}
                candidate={c}
                jdId={selectedJD}
                onAnalyze={c.score == null ? handleAnalyze : undefined}
                isAnalyzing={analyzingId === c.id}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state card">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">
              {!selectedJD ? 'Select a Job Role' : 'No Resumes Uploaded'}
            </div>
            <div className="empty-state-desc">
              {!selectedJD
                ? 'Choose a job role above to see and analyze candidates.'
                : 'You have not uploaded any resumes yet.'}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {!selectedJD && jds.length === 0 && (
                <Link to="/data-studio" className="btn btn-primary">
                  🗂️ Upload Job Descriptions
                </Link>
              )}
              {resumes.length === 0 && (
                <Link to="/data-studio" className="btn btn-secondary">
                  📄 Upload Resumes
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
