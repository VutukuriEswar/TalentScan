import React, { useState } from 'react';
import { uploadResumes, uploadJD } from '../api';
import ResumeUploader from '../components/ResumeUploader';
import toast from 'react-hot-toast';

function Upload() {
  const [resumeFiles, setResumeFiles] = useState([]);
  const [jdText, setJDText]           = useState('');
  const [jdFile, setJDFile]           = useState(null);
  const [biasRedact, setBiasRedact]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadingJD, setUploadingJD] = useState(false);
  const [results, setResults]         = useState(null);
  const [jdResult, setJDResult]       = useState(null);
  const [progress, setProgress]       = useState(0);

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
    const fd = new FormData();
    if (jdText.trim()) fd.append('text', jdText);
    else if (jdFile) fd.append('file', jdFile);
    else { toast.error('Enter JD text or upload a file'); return; }
    setUploadingJD(true);
    try {
      const res = await uploadJD(fd);
      setJDResult(res.data);
      toast.success('✅ Job Description saved & analyzed!');
    } catch (e) {
      toast.error('JD upload failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setUploadingJD(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">📤 Upload</h1>
        <p className="page-subtitle">Upload resumes and job descriptions to start AI screening</p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Left: Resumes */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">📄 Upload Resumes</div>
              <span className="badge badge-info">PDF · DOCX · TXT</span>
            </div>

            <ResumeUploader onFiles={setResumeFiles} />

            <div className="divider" />

            {/* Options */}
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

            {/* Progress */}
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

          {/* Upload results */}
          {results && (
            <div className="card mt-4 animate-fade-in-up">
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
                      <a href={`/candidate/${r.resume_id}`} className="btn btn-ghost btn-icon btn-sm">→</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: JD */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">💼 Job Description</div>
              <span className="badge badge-primary">AI Quality Check</span>
            </div>

            <div className="form-group">
              <label className="form-label">Paste JD Text</label>
              <textarea
                id="jd-text-input"
                className="form-textarea"
                rows={12}
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
                style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
              />
            </div>

            <button
              id="upload-jd-btn"
              className="btn btn-primary w-full"
              onClick={handleUploadJD}
              disabled={uploadingJD || (!jdText.trim() && !jdFile)}
            >
              {uploadingJD ? '⟳ Analyzing...' : '💼 Save & Analyze JD'}
            </button>
          </div>

          {/* JD Analysis result */}
          {jdResult && (
            <div className="card mt-4 animate-fade-in-up">
              <div className="card-header">
                <div className="card-title">🔍 JD Quality Analysis</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: jdResult.quality_analysis?.quality_score >= 7 ? 'var(--brand-success)' : 'var(--brand-warning)' }}>
                    {jdResult.quality_analysis?.quality_score}/10
                  </span>
                </div>
              </div>

              {/* Extracted data */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Required Skills</div>
                <div className="skill-tags">
                  {(jdResult.required_skills || []).map(s => (
                    <span key={s} className="skill-tag skill-tag-matched">{s}</span>
                  ))}
                </div>
              </div>

              {/* Issues */}
              {jdResult.quality_analysis?.issues?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Issues Found</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {jdResult.quality_analysis.issues.map((issue, i) => (
                      <div key={i} style={{
                        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                        borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '0.78rem',
                      }}>
                        <span className={`badge badge-${issue.type === 'BIASED' ? 'danger' : 'warning'}`} style={{ marginRight: 8 }}>
                          {issue.type}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>"{issue.text}"</span>
                        <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>→ {issue.suggestion}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {jdResult.quality_analysis?.improved_summary && (
                <div style={{ marginTop: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--brand-success)', marginBottom: 4 }}>✨ Suggested Improvement</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{jdResult.quality_analysis.improved_summary}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Upload;
