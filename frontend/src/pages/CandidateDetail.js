import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getResume, listJDs, listResumes, analyzeResume, getAnalysisResult } from '../api';
import toast from 'react-hot-toast';

function ScoreRing({ value, label, color }) {
  const pct = Math.round((value / 10) * 100);
  const r = 28, cx = 36, cy = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ marginTop: -52, fontSize: '1.1rem', fontWeight: 800, color }}>{value.toFixed(1)}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 24 }}>{label}</div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="card mb-4">
      <div className="card-header" style={{ marginBottom: 16 }}>
        <div className="card-title">{icon} {title}</div>
      </div>
      {children}
    </div>
  );
}

function CandidateDetail() {
  const { id } = useParams();
  const [resume, setResume] = useState(null);
  const [jds, setJDs] = useState([]);
  const [allResumes, setAllResumes] = useState([]);
  const [selectedJD, setSelectedJD] = useState('');
  const [selectedResume, setSelectedResume] = useState(id);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    Promise.all([getResume(id), listJDs(), listResumes()])
      .then(([rRes, jRes, allRRes]) => {
        setResume(rRes.data);
        const jdList = jRes.data.jds || [];
        setJDs(jdList);
        if (jdList.length) setSelectedJD(jdList[0].id);
        const allR = allRRes.data.resumes || [];
        setAllResumes(allR);
      })
      .catch(() => toast.error('Failed to load candidate'));
  }, [id]);

  useEffect(() => {
    if (selectedResume && selectedJD) {
      setAnalyzing(true);
      getAnalysisResult(selectedResume, selectedJD)
        .then(res => setAnalysis(res.data))
        .catch(() => setAnalysis(null))
        .finally(() => setAnalyzing(false));
    } else {
      setAnalysis(null);
    }
  }, [selectedResume, selectedJD]);

  const handleAnalyze = async () => {
    if (!selectedJD) { toast.error('Select a Job Description first'); return; }
    const resumeToUse = allResumes.length > 1 ? selectedResume : id;
    if (!resumeToUse) { toast.error('Select a resume to analyze'); return; }

    setAnalyzing(true);
    try {
      const res = await analyzeResume(resumeToUse, selectedJD);
      setAnalysis(res.data);
      toast.success('✅ AI analysis complete!');
    } catch (e) {
      const msg = e.response?.data?.detail || e.message;
      toast.error('Analysis failed: ' + msg);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!resume) return (
    <div className="loading-overlay"><div className="spinner" /><span>Loading candidate...</span></div>
  );

  const scoreColor = (s) => s >= 7 ? '#10b981' : s >= 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>← Back to Dashboard</Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, color: 'white', fontWeight: 700, flexShrink: 0,
          }}>
            {(resume.candidate_name || resume.filename)?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h1 className="page-title">{resume.candidate_name || resume.filename || 'Unknown Candidate'}</h1>
            <p className="page-subtitle">{resume.filename}</p>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {allResumes.length > 1 && (
            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <label className="form-label">Resume to Analyze</label>
              <select
                id="detail-resume-select"
                className="form-select"
                value={selectedResume}
                onChange={e => setSelectedResume(e.target.value)}
              >
                {allResumes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.candidate_name || r.filename}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">Job Description</label>
            <select
              id="detail-jd-select"
              className="form-select"
              value={selectedJD}
              onChange={e => setSelectedJD(e.target.value)}
            >
              <option value="">Select JD...</option>
              {jds.map(j => <option key={j.id} value={j.id}>{j.title || j.id}</option>)}
            </select>
          </div>

          <button
            id="detail-analyze-btn"
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={analyzing || !selectedJD}
            style={{ minWidth: 160 }}
          >
            {analyzing ? (
              <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8 }} />Analyzing...</>
            ) : analysis ? (
              '🔄 Re-analyze Resume'
            ) : (
              '🤖 Analyze Resume'
            )}
          </button>
        </div>

        {analyzing && (
          <div style={{
            marginTop: 16, padding: '12px 16px',
            background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.85rem', color: 'var(--brand-primary)',
          }}>
            🤖 AI is reading the resume and job description... This may take 15–30 seconds.
          </div>
        )}
      </div>

      {analysis && (
        <div className="animate-fade-up">
          <div className="card mb-4">
            <div className="card-header" style={{ marginBottom: 20 }}>
              <div className="card-title">🎯 AI Analysis Results</div>
              <span className={`badge badge-${(analysis.score ?? analysis.overall_score) >= 7 ? 'success' : (analysis.score ?? analysis.overall_score) >= 5 ? 'warning' : 'danger'}`}>
                Overall: {(analysis.score ?? analysis.overall_score)?.toFixed(1)}/10
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 24, marginBottom: 20 }}>
              <ScoreRing value={analysis.score ?? analysis.overall_score ?? 0} label="Overall" color={scoreColor(analysis.score ?? analysis.overall_score ?? 0)} />
              <ScoreRing value={analysis.skills_score ?? 0} label="Skills" color="#6366f1" />
              <ScoreRing value={analysis.experience_score ?? 0} label="Experience" color="#8b5cf6" />
              <ScoreRing value={analysis.education_score ?? 0} label="Education" color="#06b6d4" />
            </div>

            {analysis.justification && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Experience & Fit Summary
                </div>
                <div style={{
                  background: 'rgba(99,102,241,0.06)', borderRadius: 'var(--radius-md)',
                  padding: '12px 16px', fontSize: '0.875rem', color: 'var(--text-secondary)',
                  borderLeft: '3px solid var(--brand-primary)', fontStyle: 'italic', lineHeight: 1.7,
                }}>
                  {analysis.justification}
                </div>
              </div>
            )}

            {analysis.used_fallback && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--brand-warning)' }}>
                ⚠️ AI unavailable — scores are placeholder values. Please check your OpenRouter API key.
              </div>
            )}
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div>
              <Section title="Skills Gap Analysis" icon="🔍">
                {analysis.missing_required_skills?.length > 0 ? (
                  <div style={{
                    background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: 14,
                  }}>
                    <div style={{ fontSize: '0.72rem', color: '#ef4444', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>
                      ❌ Missing {analysis.missing_required_skills.length} Required Skill{analysis.missing_required_skills.length !== 1 ? 's' : ''}
                    </div>
                    <div className="skill-tags">
                      {analysis.missing_required_skills.map(s => <span key={s} className="skill-tag skill-tag-missing">{s}</span>)}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14, fontSize: '0.85rem', color: 'var(--brand-success)', fontWeight: 600 }}>
                    ✅ All required skills matched!
                  </div>
                )}
                {analysis.matched_skills?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--brand-success)', marginBottom: 6, fontWeight: 600 }}>✓ MATCHED</div>
                    <div className="skill-tags">
                      {analysis.matched_skills.map(s => <span key={s} className="skill-tag skill-tag-matched">{s}</span>)}
                    </div>
                  </div>
                )}
                {analysis.missing_nice_to_have_skills?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--brand-warning)', marginBottom: 6, fontWeight: 600 }}>⚡ NICE TO HAVE (MISSING)</div>
                    <div className="skill-tags">
                      {analysis.missing_nice_to_have_skills.map(s => <span key={s} className="skill-tag skill-tag-neutral">{s}</span>)}
                    </div>
                  </div>
                )}
              </Section>

              {(analysis.candidate_name || analysis.education_summary || analysis.experience_years > 0) && (
                <Section title="Candidate Profile" icon="👤">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analysis.candidate_name && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Name</span>
                        <span style={{ fontWeight: 600 }}>{analysis.candidate_name}</span>
                      </div>
                    )}
                    {analysis.experience_years > 0 && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Experience</span>
                        <span className="badge badge-info">{analysis.experience_years} years</span>
                      </div>
                    )}
                    {analysis.education_summary && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Education</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{analysis.education_summary}</span>
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </div>

            <div>
              {analysis.feedback && (
                <Section title="Candidate Feedback" icon="💬">
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {analysis.feedback}
                  </div>
                  <button
                    id="copy-feedback-btn"
                    className="btn btn-secondary btn-sm mt-4"
                    onClick={() => { navigator.clipboard.writeText(analysis.feedback); toast.success('Copied!'); }}
                  >
                    📋 Copy Feedback
                  </button>
                </Section>
              )}

              {analysis.interview_questions?.length > 0 && (
                <Section title="Interview Questions" icon="❓">
                  <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analysis.interview_questions.map((q, i) => (
                      <li key={i} style={{
                        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                        padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)',
                        borderLeft: '3px solid var(--brand-accent)',
                      }}>
                        <span style={{ fontWeight: 700, color: 'var(--brand-accent)', marginRight: 8 }}>Q{i + 1}.</span>
                        {q}
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </div>
          </div>
        </div>
      )}

      {!analysis && !analyzing && (
        <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🤖</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Ready to Analyze</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto' }}>
            Select a job description above and click <strong>Analyze Resume</strong> to run AI analysis.
            The AI will compare the full resume text against the full JD text.
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateDetail;
