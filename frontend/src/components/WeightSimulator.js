import React, { useState, useCallback } from 'react';
import { weightSimulate } from '../api';
import { ScoreRing } from './CandidateCard';
import { Link } from 'react-router-dom';

function WeightSimulator({ jdId, initialData = [] }) {
  const [skills, setSkills]   = useState(50);
  const [exp, setExp]         = useState(30);
  const [edu, setEdu]         = useState(20);
  const [ranked, setRanked]   = useState(initialData);
  const [loading, setLoading] = useState(false);

  const normalize = (s, e, u) => {
    const total = s + e + u || 1;
    return { sw: s/total, ew: e/total, uw: u/total };
  };

  const simulate = useCallback(async (sv, ev, uv) => {
    if (!jdId) return;
    setLoading(true);
    const { sw, ew, uw } = normalize(sv, ev, uv);
    try {
      const res = await weightSimulate({
        jd_id: jdId,
        skills_weight: sw,
        experience_weight: ew,
        education_weight: uw,
      });
      setRanked(res.data.ranked || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [jdId]);

  const handleSlider = (setter, val, s, e, u) => {
    setter(val);
    simulate(
      setter === setSkills ? val : s,
      setter === setExp    ? val : e,
      setter === setEdu    ? val : u,
    );
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">⚖️ Live Weight Simulator</div>
        {loading && <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        Drag sliders to instantly re-rank candidates using cached sub-scores. No LLM calls made.
      </p>

      <div className="slider-container" style={{ marginBottom: 24 }}>
        {[
          { label: 'Skills Match', val: skills, set: setSkills },
          { label: 'Experience',   val: exp,    set: setExp    },
          { label: 'Education',    val: edu,    set: setEdu    },
        ].map(({ label, val, set }) => (
          <div key={label} className="slider-row">
            <span className="slider-label">{label}</span>
            <input
              id={`slider-${label.replace(' ','')}`}
              type="range" min="0" max="100" value={val}
              onChange={e => handleSlider(set, Number(e.target.value), skills, exp, edu)}
              style={{ accentColor: 'var(--brand-primary)' }}
            />
            <span className="slider-value">{val}%</span>
          </div>
        ))}
      </div>

      {/* Ranked list */}
      {ranked.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.slice(0, 10).map((c, i) => (
            <div key={c.resume_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
              padding: '10px 14px', transition: 'var(--transition)',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                background: i < 3 ? 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' : 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }} className="truncate">
                  {c.candidate_name || c.resume_id}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Skills {c.skills_score?.toFixed(1)} · Exp {c.experience_score?.toFixed(1)} · Edu {c.education_score?.toFixed(1)}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: c.custom_score >= 7 ? 'var(--brand-success)' : c.custom_score >= 5 ? 'var(--brand-warning)' : 'var(--brand-danger)' }}>
                {c.custom_score?.toFixed(1)}
              </div>
              <Link to={`/candidate/${c.resume_id}`} className="btn btn-ghost btn-icon btn-sm" id={`ws-view-${c.resume_id}`}>→</Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: '24px' }}>
          <div className="empty-state-desc">
            {jdId ? 'Score candidates against this JD first, then use sliders to re-rank.' : 'Select a JD to enable the weight simulator.'}
          </div>
        </div>
      )}
    </div>
  );
}

export default WeightSimulator;
