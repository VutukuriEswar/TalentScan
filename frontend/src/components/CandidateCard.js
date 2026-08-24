import React from 'react';
import { Link } from 'react-router-dom';

function CandidateCard({ candidate, jdId, onAnalyze, isAnalyzing }) {
  const name = candidate.candidate_name || candidate.name || 'Unknown Candidate';
  const initial = name[0]?.toUpperCase() || '?';

  const matched = candidate.matched_skills || [];
  const missing = candidate.missing_required_skills || [];



  const analyzed = matched.length > 0 || missing.length > 0;

  return (
    <div className="card animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'white', fontWeight: 700, flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }} className="truncate">
              {name}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} className="truncate">
              {candidate.email || candidate.candidate_email || '—'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {candidate.experience_years > 0 && (
                <span className="badge badge-info">{candidate.experience_years}y exp</span>
              )}
              {candidate.score != null && (
                <span className={`badge badge-${candidate.score >= 7 ? 'success' : candidate.score >= 5 ? 'warning' : 'danger'}`}>
                  Score: {candidate.score}/10
                </span>
              )}
            </div>
          </div>
        </div>


      </div>

      {!analyzed && (
        <div style={{
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 'var(--radius-sm)', padding: '8px 12px',
          fontSize: '0.8rem', color: 'var(--brand-warning)',
        }}>
          ⚡ Not yet analyzed for this role.
        </div>
      )}

      {missing.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 'var(--radius-sm)', padding: '10px 12px',
        }}>
          <div style={{ fontSize: '0.72rem', color: '#ef4444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            ❌ Missing {missing.length} Required Skill{missing.length !== 1 ? 's' : ''}
          </div>
          <div className="skill-tags">
            {missing.map(s => (
              <span key={s} className="skill-tag skill-tag-missing">{s}</span>
            ))}
          </div>
        </div>
      )}

      {matched.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ✅ Matched Skills ({matched.length})
          </div>
          <div className="skill-tags">
            {matched.slice(0, 8).map(s => (
              <span key={s} className="skill-tag skill-tag-matched">{s}</span>
            ))}
            {matched.length > 8 && (
              <span className="skill-tag skill-tag-neutral">+{matched.length - 8}</span>
            )}
          </div>
        </div>
      )}

      {candidate.justification && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Experience & Fit Summary
          </div>
          <div style={{
            background: 'rgba(99,102,241,0.06)', borderRadius: 'var(--radius-sm)',
            padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)',
            borderLeft: '3px solid var(--brand-primary)', fontStyle: 'italic',
          }}>
            {candidate.justification}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          to={`/candidate/${candidate.resume_id || candidate.id}`}
          className="btn btn-secondary btn-sm"
          id={`view-candidate-${candidate.resume_id || candidate.id}`}
        >
          👤 View Profile
        </Link>

        {onAnalyze && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onAnalyze(candidate.resume_id || candidate.id)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '⟳ Analyzing...' : (analyzed ? '🔄 Re-analyze' : '🤖 Analyze')}
          </button>
        )}
      </div>
    </div>
  );
}

export default CandidateCard;
