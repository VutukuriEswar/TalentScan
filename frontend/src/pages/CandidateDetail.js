import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getResume, listJDs, scoreResume, getFeedback,
  getInterviewInvite, getInterviewQuestions, getAuthenticity
} from '../api';
import { ScoreRing, SubScoreBar } from '../components/CandidateCard';
import toast from 'react-hot-toast';

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
  const [jds, setJDs]       = useState([]);
  const [selectedJD, setSelectedJD] = useState('');
  const [score, setScore]   = useState(null);
  const [auth, setAuth]     = useState(null);
  const [feedback, setFeedback] = useState('');
  const [invite, setInvite] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState({ score: false, feedback: false, invite: false, questions: false });

  useEffect(() => {
    Promise.all([getResume(id), listJDs()])
      .then(([rRes, jRes]) => {
        setResume(rRes.data);
        const jdList = jRes.data.jds || [];
        setJDs(jdList);
        if (jdList.length) setSelectedJD(jdList[0].id);
      })
      .catch(() => toast.error('Failed to load candidate'));
    getAuthenticity(id).then(r => setAuth(r.data)).catch(() => {});
  }, [id]);

  const handleScore = async () => {
    if (!selectedJD) { toast.error('Select a JD'); return; }
    setLoading(p => ({ ...p, score: true }));
    const fd = new FormData();
    fd.append('resume_id', id);
    fd.append('jd_id', selectedJD);
    try {
      const res = await scoreResume(fd);
      setScore(res.data);
      toast.success('Scored successfully!');
    } catch (e) {
      toast.error('Score failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(p => ({ ...p, score: false }));
    }
  };

  const handleFeedback = async () => {
    if (!selectedJD) { toast.error('Select a JD'); return; }
    setLoading(p => ({ ...p, feedback: true }));
    try {
      const res = await getFeedback(id, selectedJD);
      setFeedback(res.data.feedback);
      toast.success('Feedback generated!');
    } catch (e) {
      toast.error('Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(p => ({ ...p, feedback: false }));
    }
  };

  const handleInvite = async () => {
    if (!selectedJD) { toast.error('Select a JD'); return; }
    setLoading(p => ({ ...p, invite: true }));
    try {
      const res = await getInterviewInvite(id, selectedJD);
      setInvite(res.data.invite);
      toast.success('Interview invite drafted!');
    } catch (e) {
      toast.error('Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(p => ({ ...p, invite: false }));
    }
  };

  const handleQuestions = async () => {
    if (!selectedJD) { toast.error('Select a JD'); return; }
    setLoading(p => ({ ...p, questions: true }));
    try {
      const res = await getInterviewQuestions(id, selectedJD);
      setQuestions(res.data.questions || []);
      toast.success('Questions generated!');
    } catch (e) {
      toast.error('Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(p => ({ ...p, questions: false }));
    }
  };

  if (!resume) return (
    <div className="loading-overlay"><div className="spinner" /><span>Loading candidate...</span></div>
  );

  const riskColor = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>← Back to Dashboard</Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, color: 'white', fontWeight: 700, flexShrink: 0,
          }}>
            {resume.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h1 className="page-title">{resume.name || 'Unknown Candidate'}</h1>
            <p className="page-subtitle">{resume.email} {resume.phone ? `· ${resume.phone}` : ''}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-info">{resume.experience_years}y experience</span>
              {auth && (
                <span className={`badge badge-${riskColor[auth.risk_level]}`}>
                  {auth.risk_level === 'LOW' ? '✓ Verified' : auth.risk_level === 'MEDIUM' ? '⚠ Review Flags' : '🚨 High Risk'}
                </span>
              )}
              {resume.bias_redacted && <span className="badge badge-warning">🎭 Blind</span>}
              {(resume.versions?.length > 0) && (
                <span className="badge badge-primary">📝 v{(resume.versions?.length || 0) + 1}</span>
              )}
            </div>
          </div>

          {score && (
            <div style={{ marginLeft: 'auto' }}>
              <ScoreRing score={score.overall_score} size={100} />
            </div>
          )}
        </div>
      </div>

      {/* JD selector + score controls */}
      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">Job Description</label>
            <select id="detail-jd-select" className="form-select" value={selectedJD} onChange={e => setSelectedJD(e.target.value)}>
              <option value="">Select JD...</option>
              {jds.map(j => <option key={j.id} value={j.id}>{j.title || j.id}</option>)}
            </select>
          </div>
          <button id="detail-score-btn" className="btn btn-primary" onClick={handleScore} disabled={loading.score || !selectedJD}>
            {loading.score ? '⟳ Scoring...' : '🎯 Score vs JD'}
          </button>
          {score && (
            <>
              <button id="detail-invite-btn" className="btn btn-secondary" onClick={handleInvite} disabled={loading.invite}>
                {loading.invite ? '⟳' : '✉️'} Draft Invite
              </button>
              <button id="detail-feedback-btn" className="btn btn-secondary" onClick={handleFeedback} disabled={loading.feedback}>
                {loading.feedback ? '⟳' : '💬'} Feedback
              </button>
              <button id="detail-questions-btn" className="btn btn-secondary" onClick={handleQuestions} disabled={loading.questions}>
                {loading.questions ? '⟳' : '❓'} Interview Q&A
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Left column */}
        <div>
          {/* Score breakdown */}
          {score && (
            <Section title="Score Breakdown" icon="🎯">
              <div style={{ marginBottom: 16 }}>
                <SubScoreBar label="Skills Match"   value={score.skills_score} />
                <SubScoreBar label="Experience"     value={score.experience_score} />
                <SubScoreBar label="Education"      value={score.education_score} />
              </div>
              {score.justification && (
                <div style={{
                  background: 'rgba(99,102,241,0.06)', borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)',
                  borderLeft: '3px solid var(--brand-primary)', fontStyle: 'italic',
                }}>
                  {score.justification}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {score.used_llm && <span className="badge badge-primary">🤖 AI Scored</span>}
                {score.used_fallback && <span className="badge badge-neutral">TF-IDF Fallback</span>}
              </div>
            </Section>
          )}

          {/* Skills */}
          <Section title="Skills" icon="💡">
            {score ? (
              <div>
                {score.matched_skills?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--brand-success)', marginBottom: 6 }}>✓ MATCHED</div>
                    <div className="skill-tags">
                      {score.matched_skills.map(s => <span key={s} className="skill-tag skill-tag-matched">{s}</span>)}
                    </div>
                  </div>
                )}
                {score.missing_required_skills?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--brand-danger)', marginBottom: 6 }}>✗ MISSING REQUIRED</div>
                    <div className="skill-tags">
                      {score.missing_required_skills.map(s => <span key={s} className="skill-tag skill-tag-missing">{s}</span>)}
                    </div>
                  </div>
                )}
                {score.missing_nice_to_have_skills?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--brand-warning)', marginBottom: 6 }}>~ MISSING NICE-TO-HAVE</div>
                    <div className="skill-tags">
                      {score.missing_nice_to_have_skills.map(s => <span key={s} className="skill-tag skill-tag-neutral">{s}</span>)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="skill-tags">
                {(resume.skills || []).map(s => <span key={s} className="skill-tag skill-tag-neutral">{s}</span>)}
              </div>
            )}
          </Section>

          {/* Experience */}
          <Section title="Experience" icon="💼">
            {(resume.experience_entries || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {resume.experience_entries.slice(0, 5).map((e, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                    padding: '12px 16px', borderLeft: '3px solid var(--brand-primary)',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.title}</div>
                    {e.company && <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{e.company}</div>}
                    {e.dates?.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        📅 {e.dates.join(' – ')}
                      </div>
                    )}
                    {e.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6, maxHeight: 80, overflow: 'hidden' }}>
                        {e.description.slice(0, 200)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted text-sm">No structured experience entries extracted.</div>
            )}
          </Section>

          {/* Education */}
          <Section title="Education" icon="🎓">
            {(resume.education || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resume.education.map((e, i) => (
                  <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500 }}>{e.degree}</div>
                    {e.context && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{e.context.slice(0, 100)}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted text-sm">No education entries extracted.</div>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div>
          {/* Authenticity */}
          {auth && (
            <Section title="Authenticity Check" icon="🔍">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span className={`badge badge-${riskColor[auth.risk_level]}`} style={{ fontSize: '0.8rem', padding: '4px 14px' }}>
                  {auth.risk_level} RISK
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {auth.is_authentic ? 'No critical inconsistencies detected' : `${auth.flags?.length} flag(s) found`}
                </span>
              </div>
              {[...(auth.flags || []), ...(auth.warnings || [])].map((f, i) => (
                <div key={i} style={{
                  background: f.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                  border: `1px solid ${f.severity === 'HIGH' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '10px 12px',
                  fontSize: '0.8rem', marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 600, color: f.severity === 'HIGH' ? 'var(--brand-danger)' : 'var(--brand-warning)', marginBottom: 4 }}>
                    {f.type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>{f.detail}</div>
                </div>
              ))}
              {auth.flags?.length === 0 && auth.warnings?.length === 0 && (
                <div style={{ color: 'var(--brand-success)', fontSize: '0.85rem' }}>
                  ✅ All employment dates, titles, and descriptions appear consistent.
                </div>
              )}
            </Section>
          )}

          {/* Resume Version History */}
          {resume.versions?.length > 0 && (
            <Section title="Version History" icon="📝">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resume.versions.map((v, i) => (
                  <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Version {i + 1} · {v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString() : '—'}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {v.skills?.length} skills · {v.experience_years}y exp · {v.filename}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Feedback */}
          {feedback && (
            <Section title="Candidate Feedback" icon="💬">
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {feedback}
              </div>
              <button
                id="copy-feedback-btn"
                className="btn btn-secondary btn-sm mt-4"
                onClick={() => { navigator.clipboard.writeText(feedback); toast.success('Copied!'); }}
              >
                📋 Copy Feedback
              </button>
            </Section>
          )}

          {/* Interview Invite */}
          {invite && (
            <Section title="Interview Invite Email" icon="✉️">
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', lineHeight: 1.7,
              }}>
                {invite}
              </div>
              <button
                id="copy-invite-btn"
                className="btn btn-primary btn-sm mt-4"
                onClick={() => { navigator.clipboard.writeText(invite); toast.success('Copied to clipboard!'); }}
              >
                📋 Copy Email
              </button>
            </Section>
          )}

          {/* Interview Questions */}
          {questions.length > 0 && (
            <Section title="Interview Questions" icon="❓">
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {questions.map((q, i) => (
                  <li key={i} style={{
                    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                    padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)',
                    borderLeft: '3px solid var(--brand-accent)',
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--brand-accent)', marginRight: 8 }}>Q{i+1}.</span>
                    {q}
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

export default CandidateDetail;
