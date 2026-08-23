import React, { useEffect, useState } from 'react';
import { listJDs, deleteJD } from '../api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function JDManager() {
  const [jds, setJDs]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listJDs();
      setJDs(res.data.jds || []);
    } catch (e) {
      toast.error('Failed to load JDs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this JD?')) return;
    try {
      await deleteJD(id);
      toast.success('JD deleted');
      setJDs(prev => prev.filter(j => j.id !== id));
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">📋 JD Manager</h1>
          <p className="page-subtitle">Manage job descriptions and view their quality analysis</p>
        </div>
        <Link to="/upload" id="add-jd-btn" className="btn btn-primary">+ Add New JD</Link>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /><span>Loading...</span></div>
      ) : jds.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No Job Descriptions</div>
          <div className="empty-state-desc">Upload your first job description to start screening candidates.</div>
          <Link to="/upload" className="btn btn-primary" style={{ marginTop: 16 }}>Go to Upload</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {jds.map(jd => {
            const qa = jd.quality_analysis || {};
            const issues = qa.issues || [];
            const qs = qa.quality_score || 0;
            return (
              <div key={jd.id} className="card animate-fade-in-up">
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Left */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 4 }}>
                      {jd.title || 'Untitled Role'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      ID: <code style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem' }}>{jd.id}</code>
                      {' · '}Added {jd.created_at ? new Date(jd.created_at).toLocaleDateString() : '—'}
                    </div>

                    {/* Skill badges */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Required Skills</div>
                      <div className="skill-tags">
                        {(jd.required_skills || []).slice(0, 8).map(s => (
                          <span key={s} className="skill-tag skill-tag-matched">{s}</span>
                        ))}
                        {(jd.required_skills || []).length > 8 && (
                          <span className="skill-tag skill-tag-neutral">+{jd.required_skills.length - 8}</span>
                        )}
                      </div>
                    </div>
                    {(jd.nice_to_have_skills || []).length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nice-to-Have</div>
                        <div className="skill-tags">
                          {jd.nice_to_have_skills.slice(0, 5).map(s => (
                            <span key={s} className="skill-tag skill-tag-neutral">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quality score */}
                  <div style={{ textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quality</div>
                    <div style={{
                      fontSize: '2rem', fontWeight: 800,
                      color: qs >= 7 ? 'var(--brand-success)' : qs >= 5 ? 'var(--brand-warning)' : 'var(--brand-danger)',
                    }}>
                      {qs}/10
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {issues.length} issue{issues.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Issues */}
                  {issues.length > 0 && (
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Issues</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {issues.slice(0, 3).map((issue, i) => (
                          <div key={i} style={{
                            fontSize: '0.75rem', padding: '5px 10px',
                            borderRadius: 'var(--radius-sm)', display: 'flex', gap: 6, alignItems: 'flex-start',
                            background: issue.type === 'BIASED' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                          }}>
                            <span className={`badge badge-${issue.type === 'BIASED' ? 'danger' : 'warning'}`} style={{ flexShrink: 0, fontSize: '0.65rem' }}>
                              {issue.type}
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>{issue.suggestion?.slice(0, 80)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <Link to="/upload" className="btn btn-secondary btn-sm" id={`view-jd-${jd.id}`}>✏️ Edit</Link>
                    <Link to={`/?jd=${jd.id}`} className="btn btn-primary btn-sm" id={`shortlist-jd-${jd.id}`}>📊 Shortlist</Link>
                    <button
                      id={`delete-jd-${jd.id}`}
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(jd.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>

                {/* Improved summary */}
                {qa.improved_summary && qa.improved_summary !== 'Analysis requires LLM. Basic heuristic applied.' && (
                  <div style={{
                    marginTop: 16, background: 'rgba(16,185,129,0.06)',
                    border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)',
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--brand-success)' }}>✨ AI Suggestion: </span>
                    {qa.improved_summary}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default JDManager;
