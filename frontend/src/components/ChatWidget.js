import React, { useState, useRef, useEffect } from 'react';
import { sendChat } from '../api';
import toast from 'react-hot-toast';

const SUGGESTIONS = [
  "Show me candidates with 3+ years of Python experience",
  "Who has AWS and Docker skills?",
  "Find candidates with fintech or banking background",
  "Which candidates have machine learning experience?",
  "Who is the best fit for a full-stack role?",
];

function ChatWidget({ className = '' }) {
  const [messages, setMessages] = useState([
    {
      id: 'init',
      role: 'assistant',
      content: "Hi! I'm TalentScan's AI recruiter assistant. I can search your candidate database using natural language. Try asking me to find candidates with specific skills or experience.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const query = text || input.trim();
    if (!query) return;

    const userMsg = { id: Date.now(), role: 'user', content: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await sendChat({ query, history });
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date(),
      }]);
    } catch (e) {
      toast.error('Chat error: ' + (e.response?.data?.detail || e.message));
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className={`chat-container card ${className}`} style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--brand-accent), var(--brand-success))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Recruiter AI Assistant</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>RAG-powered · searches your candidate database</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className={`badge ${loading ? 'badge-warning' : 'badge-success'}`}>
            {loading ? '⟳ Thinking...' : '● Online'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages" style={{ padding: '16px 20px' }}>
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className={`chat-avatar ${msg.role}`}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className={`chat-bubble ${msg.role}`}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              <div style={{ fontSize: '0.65rem', color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant">
            <div className="chat-avatar assistant">🤖</div>
            <div className="chat-bubble assistant" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--brand-accent)',
                  animation: 'pulse 1s infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div style={{ padding: '0 20px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              id={`chat-suggestion-${i}`}
              className="btn btn-secondary btn-sm"
              onClick={() => send(s)}
              style={{ fontSize: '0.75rem' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-row">
        <textarea
          id="chat-input-field"
          className="chat-input"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about candidates... (Enter to send)"
          disabled={loading}
        />
        <button
          id="chat-send-btn"
          className="btn btn-primary"
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          {loading ? '⟳' : '➤'}
        </button>
      </div>
    </div>
  );
}

export default ChatWidget;
