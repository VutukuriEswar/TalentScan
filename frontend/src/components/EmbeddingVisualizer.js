import React from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid
} from 'recharts';

const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  const isJD = payload.type === 'jd';
  const size = isJD ? 14 : 10;
  const color = isJD ? '#06b6d4' : '#6366f1';
  return (
    <g>
      <circle
        cx={cx} cy={cy} r={size}
        fill={color} fillOpacity={0.8}
        stroke={color} strokeWidth={2}
        style={{ filter: `drop-shadow(0 0 ${isJD ? 8 : 4}px ${color})`, cursor: 'pointer' }}
      />
      {isJD && (
        <circle cx={cx} cy={cy} r={size + 4} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.4} />
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.label}</div>
      <div style={{ color: 'var(--text-muted)' }}>
        Type: <span style={{ color: d.type === 'jd' ? 'var(--brand-accent)' : 'var(--brand-primary)' }}>
          {d.type === 'jd' ? 'Job Description' : 'Resume'}
        </span>
      </div>
      {d.score != null && (
        <div style={{ color: 'var(--text-muted)' }}>Score: <strong>{d.score?.toFixed(1)}</strong></div>
      )}
    </div>
  );
};

function EmbeddingVisualizer({ points = [] }) {
  const resumes = points.filter(p => p.type === 'resume');
  const jds     = points.filter(p => p.type === 'jd');

  if (points.length < 2) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">🧬 Embedding Space Visualizer</div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🌌</div>
          <div className="empty-state-title">Not enough data</div>
          <div className="empty-state-desc">Upload at least 2 resumes and 1 JD to see the 2D embedding visualization.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">🧬 Embedding Space (PCA 2D)</div>
        <div>
          <span className="badge badge-primary" style={{ marginRight: 8 }}>● Resumes ({resumes.length})</span>
          <span className="badge badge-info">● JDs ({jds.length})</span>
        </div>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        2D PCA projection of resume and JD embeddings. Candidates closer to a JD dot are semantically more similar.
      </p>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.07)" />
          <XAxis dataKey="x" name="PC1" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis dataKey="y" name="PC2" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
          <Legend
            formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{val}</span>}
          />
          <Scatter name="Resumes" data={resumes} shape={<CustomDot />} />
          <Scatter name="Job Descriptions" data={jds} shape={<CustomDot />} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EmbeddingVisualizer;
