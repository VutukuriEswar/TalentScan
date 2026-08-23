import React from 'react';
import ChatWidget from '../components/ChatWidget';

function Chat() {
  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title">💬 AI Recruiter Chat</h1>
        <p className="page-subtitle">Ask natural-language questions about your candidate pool (RAG-powered)</p>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, minHeight: 0 }}>
        <ChatWidget style={{ height: '100%' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>💡 Query Examples</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Show me candidates with React and TypeScript',
                'Who has fintech or banking experience?',
                'Find candidates with 5+ years experience',
                'Which candidates have AWS certifications?',
                'Who has worked at a startup?',
                'Find candidates suitable for a senior role',
              ].map((q, i) => (
                <div key={i} style={{
                  background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)',
                  borderLeft: '2px solid var(--border-default)',
                }}>
                  {q}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>🔍 How It Works</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>1. Vector Search</span><br />
                Your query is embedded and matched against all resume embeddings via FAISS semantic search.
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>2. Context Retrieval</span><br />
                Top matching resume profiles are retrieved as context.
              </div>
              <div>
                <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>3. LLM Synthesis</span><br />
                An LLM synthesizes the answer from the retrieved context — no hallucination without evidence.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
