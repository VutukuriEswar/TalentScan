import React, { useMemo } from 'react';

const scoreToColor = (score, alpha = 0.85) => {
  if (score == null) return `rgba(71,85,105,${alpha})`;
  if (score >= 8)  return `rgba(16,185,129,${alpha})`;
  if (score >= 6)  return `rgba(99,102,241,${alpha})`;
  if (score >= 4)  return `rgba(245,158,11,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
};

function HeatmapMatrix({ matrix = [], jdTitles = {} }) {
  const jdIds = useMemo(() => {
    if (!matrix.length) return [];
    const keys = Object.keys(matrix[0]).filter(k => k !== 'resume_id' && k !== 'candidate_name');
    return keys;
  }, [matrix]);

  if (!matrix.length || !jdIds.length) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">🧩 N×M Matching Matrix</div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No matrix data</div>
          <div className="empty-state-desc">Upload resumes and JDs, then trigger bulk scoring to generate the heatmap.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">🧩 N×M Matching Matrix</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(16,185,129,0.8)', display: 'inline-block' }} /> 8–10
          </span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(99,102,241,0.8)', display: 'inline-block' }} /> 6–8
          </span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(245,158,11,0.8)', display: 'inline-block' }} /> 4–6
          </span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(239,68,68,0.8)', display: 'inline-block' }} /> &lt;4
          </span>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, minWidth: jdIds.length * 90 + 160 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Candidate
              </th>
              {jdIds.map(jid => (
                <th key={jid} style={{
                  textAlign: 'center', padding: '6px 8px',
                  fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600,
                  maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {(jdTitles[jid] || jid).slice(0, 15)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, ri) => (
              <tr key={row.resume_id}>
                <td style={{
                  padding: '4px 12px 4px 4px', fontSize: '0.8rem', fontWeight: 500,
                  whiteSpace: 'nowrap', maxWidth: 150,
                }} className="truncate">
                  {row.candidate_name || row.resume_id.slice(0, 8)}
                </td>
                {jdIds.map(jid => {
                  const score = row[jid];
                  return (
                    <td key={jid} style={{ padding: 2, textAlign: 'center' }}>
                      <div
                        className="heatmap-cell"
                        title={score != null ? `Score: ${score.toFixed(1)}` : 'Not scored'}
                        style={{
                          background: scoreToColor(score),
                          color: 'white',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          borderRadius: 6,
                          padding: '6px 4px',
                          minWidth: 60,
                        }}
                      >
                        {score != null ? score.toFixed(1) : '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        {matrix.length} candidates × {jdIds.length} job descriptions · Pending scores will compute in background
      </div>
    </div>
  );
}

export default HeatmapMatrix;
