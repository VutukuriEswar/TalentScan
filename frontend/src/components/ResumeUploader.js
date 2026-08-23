import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

function ResumeUploader({ onFiles, accept = '.pdf,.docx,.txt,.doc', maxFiles = 50 }) {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    setSelectedFiles(prev => {
      const merged = [...prev, ...acceptedFiles].slice(0, maxFiles);
      onFiles && onFiles(merged);
      return merged;
    });
  }, [onFiles, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
    },
    maxFiles,
  });

  const removeFile = (idx) => {
    setSelectedFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      onFiles && onFiles(next);
      return next;
    });
  };

  return (
    <div>
      <div {...getRootProps()} className={`dropzone${isDragActive ? ' active' : ''}`}>
        <input {...getInputProps()} id="resume-uploader-input" />
        <span className="dropzone-icon">📄</span>
        <div className="dropzone-text">
          {isDragActive
            ? <strong>Drop files here...</strong>
            : <><strong>Click to upload</strong> or drag & drop resumes here</>
          }
          <br />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            PDF, DOCX, DOC, TXT · up to {maxFiles} files
          </span>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {selectedFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
                padding: '6px 12px', fontSize: '0.8rem',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{f.name.endsWith('.pdf') ? '📕' : f.name.endsWith('.docx') || f.name.endsWith('.doc') ? '📘' : '📄'}</span>
                  <span className="truncate" style={{ maxWidth: 300 }}>{f.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>({(f.size / 1024).toFixed(0)} KB)</span>
                </span>
                <button
                  id={`remove-file-${i}`}
                  onClick={() => removeFile(i)}
                  className="btn btn-ghost btn-icon btn-sm"
                  style={{ color: 'var(--brand-danger)', marginLeft: 8 }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ResumeUploader;
