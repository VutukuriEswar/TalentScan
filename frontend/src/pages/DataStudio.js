import React, { useState, useEffect } from 'react';
import { uploadResumes, uploadJD, listJDs, deleteJD, listResumes, deleteResume } from '../api';
import ResumeUploader from '../components/ResumeUploader';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function DataStudio() {
  const [resumeFiles, setResumeFiles] = useState([]);
  const [biasRedact, setBiasRedact] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [jdText, setJDText] = useState('');
  const [jdTitle, setJDTitle] = useState('');
  const [jdFile, setJDFile] = useState(null);
  const [uploadingJD, setUploadingJD] = useState(false);
  const [jds, setJDs] = useState([]);
  const [loadingJDs, setLoadingJDs] = useState(true);
  const [activeTab, setActiveTab] = useState('upload');
  const [resumes, setResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(false);

  const loadResumes = async () => {
    setLoadingResumes(true);
    try {
      const res = await listResumes();
      setResumes(res.data.resumes || []);
    } catch (e) {
      toast.error('Failed to load resumes');
    } finally {
      setLoadingResumes(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'library') {
      loadResumes();
    }
  }, [activeTab]);

  const handleDeleteResume = async (id) => {
    if (!window.confirm('Delete this resume?')) return;
    try {
      await deleteResume(id);
      toast.success('Resume deleted');
      setResumes(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const loadJDs = async () => {
    setLoadingJDs(true);
    try {
      const res = await listJDs();
      setJDs(res.data.jds || []);
    } catch (e) {
      toast.error('Failed to load Job Descriptions');
    } finally {
      setLoadingJDs(false);
    }
  };

  useEffect(() => {
    loadJDs();
  }, []);

  const handleUploadResumes = async () => {
    if (!resumeFiles.length) { toast.error('Add at least one resume file'); return; }
    setUploading(true);
    setProgress(0);
    const fd = new FormData();
    resumeFiles.forEach(f => fd.append('files', f));
    fd.append('bias_redact', biasRedact);
    try {
      const res = await uploadResumes(fd, (e) => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      setResults(res.data);
      toast.success(`✅ ${res.data.uploaded} resume(s) processed!`);
      setResumeFiles([]);
      setProgress(0);
    } catch (e) {
      toast.error('Upload failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const handleUploadJD = async () => {
    if (!jdTitle.trim()) { toast.error('Please enter a Job Title'); return; }
    const fd = new FormData();
    fd.append('title', jdTitle.trim());
    if (jdText.trim()) fd.append('text', jdText);
    else if (jdFile) fd.append('file', jdFile);
    else { toast.error('Enter JD text or upload a file'); return; }

    setUploadingJD(true);
    try {
      await uploadJD(fd);
      toast.success('✅ Job Description saved & analyzed!');
      setJDTitle('');
      setJDText('');
      setJDFile(null);
      const fileInput = document.getElementById('jd-file-input');
      if (fileInput) fileInput.value = '';

      loadJDs();
    } catch (e) {
      toast.error('JD upload failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setUploadingJD(false);
    }
  };

  const handleDeleteJD = async (id) => {
    if (!window.confirm('Delete this Job Description?')) return;
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
      <div className="page-header">
        <h1 className="page-title">🗂️ Data Studio</h1>
        <p className="page-subtitle">Upload resumes and manage Job Descriptions for AI screening</p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>

        <div className="animate-fade-up delay-100">
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
            <button className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('upload')}>📄 Upload</button>
            <button className={`btn btn-sm ${activeTab === 'library' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('library')}>📚 Resume Library</button>
          </div>

          {activeTab === 'upload' ? (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📄 Upload Resumes</div>
                <span className="badge badge-info">PDF · DOCX · TXT</span>
              </div>

              <ResumeUploader onFiles={setResumeFiles} />

              <div className="divider" />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    id="bias-redact-toggle"
                    type="checkbox"
                    checked={biasRedact}
                    onChange={e => setBiasRedact(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)' }}
                  />
                  <span>🎭 Bias-reduction mode</span>
                  <span className="badge badge-warning">blind screening</span>
                </label>
              </div>
              {biasRedact && (
                <div style={{
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  fontSize: '0.8rem', color: 'var(--brand-warning)', marginBottom: 16,
                }}>
                  ⚠️ Names, email addresses, gender markers, and age indicators will be redacted before scoring.
                </div>
              )}

              {uploading && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>Uploading... {progress}%</div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              <button
                id="upload-resumes-btn"
                className="btn btn-primary w-full"
                onClick={handleUploadResumes}
                disabled={uploading || !resumeFiles.length}
              >
                {uploading ? '⟳ Processing...' : `🚀 Upload ${resumeFiles.length || ''} Resume${resumeFiles.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📚 Resume Library</div>
                <span className="badge badge-neutral">{resumes.length} total</span>
              </div>

              {loadingResumes ? (
                <div className="loading-overlay" style={{ minHeight: 150 }}><div className="spinner" /></div>
              ) : resumes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-desc">No resumes uploaded yet.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                  {resumes.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.name || r.filename}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {r.skills?.length || 0} skills · {r.experience_years || 0}y exp
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link to={`/candidate/${r.id}`} className="btn btn-ghost btn-sm btn-icon">→</Link>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--brand-danger)' }} onClick={() => handleDeleteResume(r.id)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {results && (
            <div className="card mt-4 animate-fade-up delay-200">
              <div className="card-header">
                <div className="card-title">✅ Upload Results</div>
                <span className="badge badge-success">{results.uploaded} processed</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.results.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: r.error ? 'rgba(239,68,68,0.06)' : r.skipped ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)',
                    borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '0.8rem',
                    border: `1px solid ${r.error ? 'rgba(239,68,68,0.2)' : r.skipped ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
                  }}>
                    <span>{r.error ? '❌' : r.skipped ? '⚠️' : '✅'}</span>
                    <div style={{ flex: 1 }}>
                      <div className="truncate" style={{ fontWeight: 500 }}>{r.filename}</div>
                      {r.name && <div style={{ color: 'var(--text-muted)' }}>{r.name} · {r.skills_found} skills · {r.experience_years}y exp</div>}
                      {r.error && <div style={{ color: 'var(--brand-danger)' }}>{r.error}</div>}
                      {r.skipped && <div style={{ color: 'var(--brand-warning)' }}>Duplicate detected</div>}
                      {r.authenticity_risk && r.authenticity_risk !== 'LOW' && (
                        <span className={`badge badge-${r.authenticity_risk === 'HIGH' ? 'danger' : 'warning'}`} style={{ marginTop: 4 }}>
                          🔍 {r.authenticity_risk} risk
                        </span>
                      )}
                    </div>
                    {r.resume_id && (
                      <Link to={`/candidate/${r.resume_id}`} className="btn btn-ghost btn-icon btn-sm">→</Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="animate-fade-up delay-200" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div className="card">
            <div className="card-header">
              <div className="card-title">💼 Add Job Description</div>
              <span className="badge badge-primary">AI Quality Check</span>
            </div>

            <div className="form-group">
              <label className="form-label">Job Title <span style={{ color: 'var(--brand-danger)' }}>*</span></label>
              <input
                id="jd-title-input"
                className="form-input"
                value={jdTitle}
                onChange={e => setJDTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Paste JD Text</label>
              <textarea
                id="jd-text-input"
                className="form-textarea"
                rows={8}
                value={jdText}
                onChange={e => setJDText(e.target.value)}
                placeholder="Paste the full job description here...&#10;&#10;Include: job title, responsibilities, required skills, experience level, and qualifications."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>or upload file</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <input
                id="jd-file-input"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={e => setJDFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="jd-file-input"
                className="btn btn-secondary"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, cursor: 'pointer', borderStyle: 'dashed',
                  backgroundColor: 'rgba(255,255,255,0.02)'
                }}
              >
                <span style={{ fontSize: '0.85rem' }}>📎 {jdFile ? jdFile.name : 'Browse for file...'}</span>
              </label>
            </div>

            <button
              id="upload-jd-btn"
              className="btn btn-primary w-full"
              onClick={handleUploadJD}
              disabled={uploadingJD || (!jdText.trim() && !jdFile) || !jdTitle.trim()}
            >
              {uploadingJD ? '⟳ Analyzing...' : '💼 Save & Analyze JD'}
            </button>
          </div>

          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 16, fontWeight: 700 }}>JD Repository</h3>

            {loadingJDs ? (
              <div className="loading-overlay" style={{ minHeight: 150 }}><div className="spinner" /></div>
            ) : jds.length === 0 ? (
              <div className="empty-state card" style={{ padding: '30px 20px' }}>
                <div className="empty-state-icon" style={{ fontSize: '2rem' }}>📋</div>
                <div className="empty-state-title" style={{ fontSize: '1rem' }}>No Job Descriptions</div>
                <div className="empty-state-desc" style={{ fontSize: '0.85rem' }}>Upload your first JD above.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {jds.map((jd, idx) => {
                  const qa = jd.quality_analysis || {};
                  const issues = qa.issues || [];
                  const qs = qa.quality_score || 0;

                  return (
                    <div key={jd.id} className={`card animate-fade-up delay-${Math.min((idx + 3) * 100, 500)}`} style={{ padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{jd.title || 'Untitled Role'}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            ID: <code>{jd.id}</code>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Link to={`/?jd=${jd.id}`} className="btn btn-primary btn-sm">📊 Analyze</Link>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteJD(jd.id)}>🗑️</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quality:</span>
                          <span style={{
                            fontWeight: 800,
                            color: qs >= 7 ? 'var(--brand-success)' : qs >= 5 ? 'var(--brand-warning)' : 'var(--brand-danger)'
                          }}>
                            {qs}/10
                          </span>
                        </div>

                        {issues.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.06)', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--brand-warning)' }}>⚠️ {issues.length} Issues</span>
                          </div>
                        )}
                      </div>

                      {qa.improved_summary && qa.improved_summary !== 'Analysis requires LLM. Basic heuristic applied.' && (
                        <div style={{
                          marginTop: 12, background: 'rgba(16,185,129,0.06)',
                          border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)',
                          padding: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)'
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

        </div>
      </div>
    </div>
  );
}

export default DataStudio;
