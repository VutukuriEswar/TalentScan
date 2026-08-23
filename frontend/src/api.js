import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 60000,
});

// Device ID (Privacy)
const getDeviceId = () => {
  let id = localStorage.getItem('ts_device_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('ts_device_id', id);
  }
  return id;
};

api.interceptors.request.use((config) => {
  config.headers['X-Device-ID'] = getDeviceId();
  return config;
});

// Resumes
export const uploadResumes = (formData, onProgress) =>
  api.post('/api/resumes/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  });

export const listResumes = (params) => api.get('/api/resumes', { params });
export const getResume = (id) => api.get(`/api/resumes/${id}`);
export const deleteResume = (id) => api.delete(`/api/resumes/${id}`);
export const getAuthenticity = (id) => api.get(`/api/authenticity/${id}`);

// Job Descriptions
export const uploadJD = (formData) =>
  api.post('/api/jd/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const listJDs = () => api.get('/api/jd');
export const getJD = (id) => api.get(`/api/jd/${id}`);
export const deleteJD = (id) => api.delete(`/api/jd/${id}`);

// Matching
export const scoreResume = (formData) =>
  api.post('/api/match/score', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const scoreBulk = (formData) =>
  api.post('/api/match/bulk', formData, { headers: { 'Content-Type': 'multipart/form-data' } });


// Gap Analysis
export const getAnalysis = (jdId, params) => api.get(`/api/analysis/${jdId}`, { params });

// Chat
export const sendChat = (data) => api.post('/api/chat', data);

// Feedback & Actions
export const getFeedback = (resumeId, jdId) => api.post(`/api/feedback/${resumeId}/${jdId}`);
export const getInterviewInvite = (resumeId, jdId) => api.post(`/api/interview-invite/${resumeId}/${jdId}`);
export const getInterviewQuestions = (resumeId, jdId) => api.post(`/api/interview-questions/${resumeId}/${jdId}`);

// Analytics
export const getSkillAnalytics = () => api.get('/api/analytics/skills');
export const getScoreDistribution = (jdId) => api.get(`/api/analytics/score-distribution/${jdId}`);



// Health
export const healthCheck = () => api.get('/api/health');

export default api;
