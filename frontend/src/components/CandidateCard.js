import React from 'react';
import { Link } from 'react-router-dom';

function ScoreRing({ score, size = 80 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444';
  const pct = score / 10;

  return (
    <div className="score-ring-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={6} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <span className="score-value" style={{ color, WebkitTextFillColor: color, backgroundImage: 'none' }}>
        {score?.toFixed(1)}
      </span>
    </div>
  );
}

function SubScoreBar({ label, value }) {
  return (
    <div className="progress-bar-container">
      <span className="progress-bar-label">{label}</span>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${(value / 10) * 100}%` }} />
      </div>
      <span className="progress-bar-value">{value?.toFixed(1)}</span>
    </div>
  );
}

function CandidateCard({ candidate, jdId, onScore }) {
  const score = candidate.score ?? candidate.latest_score;
  const hasScore = score != null;

  const riskColors = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };
  const risk = candidate.authenticity?.risk_level || 'LOW';

  return (
    <div className="card animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'white', fontWeight: 700, flexShrink: 0,
          }}>
            {(candidate.name || candidate.candidate_name || '?')[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }} className="truncate">
              {candidate.name || candidate.candidate_name || 'Unknown Candidate'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} className="truncate">
              {candidate.email || candidate.candidate_email || '—'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {candidate.experience_years > 0 && (
                <span className="badge badge-info">{candidate.experience_years}y exp</span>
              )}
              <span className={`badge badge-${riskColors[risk]}`}>
                {risk === 'LOW' ? '✓ Verified' : risk === 'MEDIUM' ? '⚠ Review' : '🚨 Flags'}
              </span>
              {candidate.used_llm && <span className="badge badge-primary">🤖 AI</span>}
              {candidate.used_fallback && <span className="badge badge-neutral">TF-IDF</span>}
            </div>
          </div>
        </div>
        {hasScore && <ScoreRing score={score} size={72} />}
      </div>

      {/* Sub-scores */}
      {hasScore && candidate.skills_score != null && (
        <div>
          <SubScoreBar label="Skills Match" value={candidate.skills_score} />
          <SubScoreBar label="Experience"   value={candidate.experience_score} />
          <SubScoreBar label="Education"    value={candidate.education_score} />
        </div>
      )}

      {/* Matched skills */}
      {candidate.matched_skills?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Matched Skills
          </div>
          <div className="skill-tags">
            {candidate.matched_skills.slice(0, 6).map(s => (
              <span key={s} className="skill-tag skill-tag-matched">{s}</span>
            ))}
            {candidate.matched_skills.length > 6 && (
              <span className="skill-tag skill-tag-neutral">+{candidate.matched_skills.length - 6}</span>
            )}
          </div>
        </div>
      )}

      {/* Missing required skills */}
      {candidate.missing_required_skills?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Missing Required
          </div>
          <div className="skill-tags">
            {candidate.missing_required_skills.slice(0, 4).map(s => (
              <span key={s} className="skill-tag skill-tag-missing">{s}</span>
            ))}
            {candidate.missing_required_skills.length > 4 && (
              <span className="skill-tag skill-tag-neutral">+{candidate.missing_required_skills.length - 4}</span>
            )}
          </div>
        </div>
      )}

      {/* Justification */}
      {candidate.justification && (
        <div style={{
          background: 'rgba(99,102,241,0.06)', borderRadius: 'var(--radius-sm)',
          padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)',
          borderLeft: '3px solid var(--brand-primary)',
          fontStyle: 'italic',
        }}>
          {candidate.justification}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        <Link
          to={`/candidate/${candidate.resume_id || candidate.id}`}
          className="btn btn-secondary btn-sm"
          id={`view-candidate-${candidate.resume_id || candidate.id}`}
        >
          👤 View Profile
        </Link>
        {!hasScore && jdId && (
          <button
            id={`score-candidate-${candidate.id}`}
            className="btn btn-primary btn-sm"
            onClick={() => onScore && onScore(candidate.id)}
          >
            🎯 Score Now
          </button>
        )}
      </div>
    </div>
  );
}

export { ScoreRing, SubScoreBar };
export default CandidateCard;
