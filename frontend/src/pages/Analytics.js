import React, { useEffect, useState } from 'react';
import { getSkillAnalytics, listJDs, getScoreDistribution } from '../api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';

import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16'];

function Analytics() {
  const [skillData, setSkillData] = useState(null);
  const [jds, setJDs] = useState([]);
  const [selectedJD, setSelectedJD] = useState('');
  const [distData, setDistData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSkillAnalytics(),
      listJDs(),
    ]).then(([skill, jdRes]) => {
      setSkillData(skill.data);
      const jdList = jdRes.data.jds || [];
      setJDs(jdList);
      if (jdList.length) {
        setSelectedJD(jdList[0].id);
        loadDist(jdList[0].id);
      }
    }).catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);


  const loadDist = async (jdId) => {
    try {
      const res = await getScoreDistribution(jdId);
      setDistData(res.data.buckets || []);
    } catch (e) { }
  };



  if (loading) return (
    <div className="loading-overlay"><div className="spinner" /><span>Loading analytics...</span></div>
  );

  const resumeSkills = skillData?.top_resume_skills?.slice(0, 12) || [];
  const jdSkills = skillData?.top_jd_skills?.slice(0, 8) || [];
  const scoreStats = skillData?.score_stats_by_jd || [];

  const pieData = resumeSkills.slice(0, 8).map((s, i) => ({
    name: s.skill, value: s.count, color: COLORS[i % COLORS.length]
  }));

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">📈 Analytics</h1>
        <p className="page-subtitle">Skill demand insights, score distributions, and embedding visualization</p>
      </div>

      <div className="grid-2 mb-6">

        <div className="card">
          <div className="card-header">
            <div className="card-title">💡 Top Skills in Candidate Pool</div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={resumeSkills} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.07)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="skill" width={90} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                {resumeSkills.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🎯 Most Demanded Skills (JDs)</div>
          </div>
          {jdSkills.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData.filter(d => d.name)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-desc">No JDs uploaded yet. Add some job descriptions first.</div>
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <div className="card-title">📊 Score Distribution</div>
          <select
            id="analytics-jd-select"
            className="form-select"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={selectedJD}
            onChange={e => { setSelectedJD(e.target.value); loadDist(e.target.value); }}
          >
            {jds.map(j => <option key={j.id} value={j.id}>{j.title || j.id}</option>)}
          </select>
        </div>
        {distData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={distData} margin={{ left: 0, right: 20 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.07)" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10 }} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#scoreGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-desc">Score some resumes first to see the distribution.</div>
          </div>
        )}
      </div>

      {scoreStats.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📉 Average Fit Scores Per Role</div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Candidates Scored</th>
                  <th>Avg Score</th>
                  <th>Top Score</th>
                </tr>
              </thead>
              <tbody>
                {scoreStats.map(s => (
                  <tr key={s.jd_id}>
                    <td>
                      {jds.find(j => j.id === s.jd_id)?.title || (
                        <span className="font-mono text-xs text-muted">{s.jd_id.slice(0, 12)}…</span>
                      )}
                    </td>
                    <td>{s.candidate_count}</td>
                    <td style={{ color: s.avg_score >= 6 ? 'var(--brand-success)' : 'var(--brand-warning)', fontWeight: 700 }}>
                      {s.avg_score}
                    </td>
                    <td style={{ fontWeight: 700 }}>{s.max_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
