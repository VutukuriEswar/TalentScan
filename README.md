# TalentScan 🎯

> **AI-powered resume screening and candidate matching platform**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb)](https://mongodb.com)
[![FAISS](https://img.shields.io/badge/FAISS-Vector%20DB-FF6B6B)](https://github.com/facebookresearch/faiss)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📋 Table of Contents
1. [Features](#features)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Project Structure](#project-structure)
5. [API Reference](#api-reference)
6. [LLM Prompts](#llm-prompts)
7. [Tech Stack](#tech-stack)
8. [Configuration](#configuration)

---

## ✨ Features

### Tier 1 — Core
- ✅ Upload PDF, DOCX, and TXT resumes (single or bulk)
- ✅ Upload / paste job descriptions
- ✅ Extract structured data: skills, experience, education
- ✅ LLM-based match score (1–10) with justification
- ✅ Ranked shortlist with score breakdown per candidate

### Tier 2 — Strong Enhancements
- ✅ Hybrid parsing: spaCy NER + LLM fallback for ambiguous resumes
- ✅ Semantic skill matching via sentence-transformers embeddings
- ✅ Score breakdown: skills / experience / education sub-scores
- ✅ Skill gap analysis — matched vs missing required/nice-to-have skills
- ✅ Zero-hallucination safeguard — LLM skill claims verified against resume text
- ✅ TF-IDF / cosine fallback when LLM is unavailable or rate-limited
- ✅ Bulk upload — screen N resumes vs one JD, async background processing
- ✅ Multi-JD mode — one resume vs all open roles
- ✅ Auto-generated interview questions based on skill gaps
- ✅ Export shortlist as CSV
- ✅ Sortable/filterable dashboard (score, skills, experience)
- ✅ Score distribution chart (Recharts AreaChart)
- ✅ Bias-reduction mode — redacts name, gender pronouns, age before scoring
- ✅ Duplicate candidate detection via embedding cosine similarity
- ✅ Audit log — every scoring event tracked with SHA-256 hash

### Tier 3 — Signature Features
- ✅ **Recruiter Chat Assistant (RAG)** — natural-language search over candidate pool
- ✅ **Live Weight Simulator** — re-rank candidates instantly via sliders
- ✅ **JD Quality & Bias Analyzer** — scans JDs for vague/exclusionary language
- ✅ **Resume Authenticity Checker** — detects date overlaps, gaps, title mismatches
- ✅ **Candidate Feedback Generator** — constructive improvement suggestions
- ✅ **N×M Batch Matching Matrix** — full heatmap of all resumes × all JDs
- ✅ **Embedding Space Visualizer** — 2D PCA scatter plot
- ✅ **Auto-Drafted Interview Invite** — personalized email per candidate
- ✅ **Skill Demand Analytics Dashboard** — most common skills, avg scores per role
- ✅ **Resume Version History** — track re-uploads and score trends

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────┐
│                React Frontend                 │
│   Dashboard · Upload · Analytics · Chat       │
│   CandidateDetail · JDManager · AuditLog      │
└──────────────────────┬───────────────────────┘
                       │ Axios HTTP
┌──────────────────────▼───────────────────────┐
│             FastAPI (server.py)               │
│                                               │
│  ┌─────────────┐   ┌───────────────────────┐ │
│  │  Parsing    │   │   Scoring Pipeline    │ │
│  │  PDF/DOCX   │   │   LLM → Structured    │ │
│  │  Text       │   │   JSON Sub-scores     │ │
│  └─────────────┘   └───────────────────────┘ │
│                                               │
│  ┌─────────────┐   ┌───────────────────────┐ │
│  │  NER/spaCy  │   │   Embedding Engine    │ │
│  │  + LLM fb   │   │   sentence-tfmrs      │ │
│  └─────────────┘   └───────────────────────┘ │
│                                               │
│  ┌─────────────┐   ┌───────────────────────┐ │
│  │  RAG Chat   │   │   TF-IDF Fallback     │ │
│  │  FAISS      │   │   (no LLM needed)     │ │
│  └─────────────┘   └───────────────────────┘ │
└───────────┬──────────────────┬───────────────┘
            │                  │
   ┌─────────▼────┐   ┌────────▼───────┐
   │   MongoDB    │   │  FAISS Index   │
   │  resumes     │   │  (disk file)   │
   │  jds         │   └────────────────┘
   │  scores      │
   │  feedback    │
   │  audit_logs  │
   └──────────────┘
```

### Data Flow

```
Resume Upload → Text Extraction → NER/spaCy Extraction
    → Embedding (sentence-transformers) → FAISS Index
    → MongoDB Storage → Ready for scoring

JD Upload → Text Extraction → Structured Fields
    → LLM Quality/Bias Analysis → FAISS Index → MongoDB

Score Request → Resume + JD retrieved from MongoDB
    → Semantic Skill Match (embeddings) → LLM Scoring
    → Zero-Hallucination Guard → Sub-score Breakdown
    → MongoDB Scores Collection → Frontend Display
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB running on `localhost:27017`

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm

# Configure environment
cp .env.example .env
# Edit .env: add your OPENROUTER_API_KEY (optional — TF-IDF fallback works without it)

# Start server
python server.py
# OR: uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Server will be available at: `http://localhost:8000`  
API docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend will be available at: `http://localhost:3000`

---

## 📁 Project Structure

```
TalentScan/
├── .gitignore
├── LICENSE
├── README.md
├── DEMO_SCRIPT.md
│
├── backend/
│   ├── .env                  # Local secrets (gitignored)
│   ├── .env.example          # Template for environment variables
│   ├── requirements.txt      # Python dependencies
│   ├── server.py             # Full FastAPI application (23 sections)
│   ├── uploads/              # Temporary file storage
│   ├── faiss_index.bin       # FAISS vector index (auto-created)
│   └── faiss_index.pkl       # FAISS metadata (auto-created)
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── api.js            # Centralized Axios API client
    │   ├── App.js            # Root component + routing
    │   ├── index.css         # Full design system (dark glassmorphism)
    │   ├── index.js          # React entry point
    │   ├── components/
    │   │   ├── CandidateCard.js      # Score card with ring + bars
    │   │   ├── ChatWidget.js         # RAG chat interface
    │   │   ├── EmbeddingVisualizer.js # 2D PCA scatter plot
    │   │   ├── ExportButtons.js      # CSV / print export
    │   │   ├── HeatmapMatrix.js      # N×M matching heatmap
    │   │   ├── ResumeUploader.js     # Drag-and-drop uploader
    │   │   └── WeightSimulator.js    # Live weight sliders
    │   └── pages/
    │       ├── Dashboard.js          # Shortlist + weight simulator
    │       ├── Upload.js             # Resume + JD upload
    │       ├── CandidateDetail.js    # Full profile + actions
    │       ├── Analytics.js          # Charts + heatmap + embeddings
    │       ├── Chat.js               # RAG chat page
    │       ├── JDManager.js          # JD list + quality analysis
    │       └── AuditLog.js           # Immutable event log
    └── package.json
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health check |
| POST | `/api/resumes/upload` | Upload PDF/DOCX/TXT resumes |
| GET | `/api/resumes` | List all resumes |
| GET | `/api/resumes/{id}` | Get resume detail |
| DELETE | `/api/resumes/{id}` | Delete resume |
| GET | `/api/authenticity/{id}` | Get authenticity analysis |
| POST | `/api/jd/upload` | Upload/paste job description |
| GET | `/api/jd` | List all JDs |
| GET | `/api/jd/{id}` | Get JD detail |
| DELETE | `/api/jd/{id}` | Delete JD |
| POST | `/api/match/score` | Score 1 resume vs 1 JD |
| POST | `/api/match/bulk` | Score N resumes vs 1 JD (async) |
| POST | `/api/match/matrix` | N×M matching matrix |
| POST | `/api/match/weight-simulate` | Re-rank with custom weights |
| GET | `/api/shortlist/{jd_id}` | Get ranked shortlist |
| POST | `/api/chat` | RAG chat query |
| POST | `/api/feedback/{resume_id}/{jd_id}` | Generate candidate feedback |
| POST | `/api/interview-invite/{resume_id}/{jd_id}` | Draft interview invite |
| POST | `/api/interview-questions/{resume_id}/{jd_id}` | Generate interview questions |
| GET | `/api/analytics/skills` | Skill demand analytics |
| GET | `/api/analytics/embeddings` | 2D embedding coordinates |
| GET | `/api/analytics/score-distribution/{jd_id}` | Score histogram |
| GET | `/api/audit` | Audit log |
| GET | `/api/export/shortlist/{jd_id}` | Export shortlist as CSV |

Full interactive API docs available at `/docs` (Swagger UI) and `/redoc`.

---

## 🤖 LLM Prompts

All prompts are designed for OpenRouter-compatible APIs. Model: configurable via `OPENROUTER_MODEL` env var (default: `openai/gpt-4o-mini`).

### 1. Match Scoring Prompt
**Purpose:** Rate candidate fit on 1–10 with structured breakdown

```
System:
You are an expert technical recruiter and HR analyst.
You will receive a candidate's resume and a job description.
Your task: rate the candidate's fit on a 1–10 scale and provide a structured JSON breakdown.

IMPORTANT RULES:
- Only reference skills that are explicitly present in the resume text provided.
- Do not invent or assume skills not mentioned.
- Return ONLY valid JSON — no markdown, no commentary.

Output format:
{
  "overall_score": <float 1-10>,
  "skills_score": <float 1-10>,
  "experience_score": <float 1-10>,
  "education_score": <float 1-10>,
  "justification": "<2-3 sentence explanation>",
  "matched_skills": ["skill1", "skill2"],
  "missing_required_skills": ["skill3"],
  "missing_nice_to_have_skills": ["skill4"]
}

User:
Compare the following resume with this job description and rate fit on 1–10 with justification.

=== RESUME ===
{resume_text}

=== JOB DESCRIPTION ===
{jd_text}
```

### 2. JD Quality & Bias Analysis Prompt
**Purpose:** Detect vague, biased, or stacked requirements in a job description

```
System:
You are an expert DEI consultant and HR specialist analyzing a job description.
Analyze the JD for:
1. Vague or unmeasurable requirements (e.g., "rockstar", "ninja", "fast-paced")
2. Requirement stacking (too many must-have years/skills for what seems a mid-level role)
3. Exclusionary or biased language (gender-coded, age-biased, disability-discriminatory)
4. Missing elements (no mention of compensation, unclear seniority level, no mention of remote/hybrid)

Return ONLY valid JSON:
{
  "quality_score": <int 1-10>,
  "issues": [{"type": "VAGUE|BIASED|STACKED|MISSING", "text": "...", "suggestion": "..."}],
  "improved_summary": "<rewritten 2-3 sentence JD intro without issues>"
}

User:
Job Description:
{jd_text}
```

### 3. Candidate Feedback Prompt
**Purpose:** Generate constructive improvement feedback for non-shortlisted candidates

```
System:
You are a supportive career coach. A candidate was not shortlisted for a role.
Given their score breakdown and missing skills, generate constructive, specific,
actionable feedback to help them improve their profile for similar roles.
Be encouraging but honest. Use bullet points. Return ONLY plain text (no JSON).
Keep it under 300 words.

User:
Candidate: {name}
Role applied for: {jd_title}
Overall score: {score}/10
Skills score: {skills_score}/10
Experience score: {experience_score}/10
Education score: {education_score}/10
Missing required skills: {missing_required_skills}
Missing nice-to-have skills: {missing_nice_to_have_skills}
Justification: {justification}

Provide constructive feedback for this candidate.
```

### 4. Interview Questions Prompt
**Purpose:** Generate targeted interview questions based on skill gaps

```
System:
You are a senior technical interviewer. Based on the candidate's skill gaps
relative to the job description, generate 5–7 targeted interview questions.
Include mix of: technical depth, behavioral, and situational questions.
Return as a JSON array of strings. No markdown.

User:
Role: {jd_title}
Candidate skill gaps: {missing_skills}

Generate 5-7 targeted interview questions.
```

### 5. Interview Invite Prompt
**Purpose:** Draft a personalized interview invitation email

```
System:
You are a professional recruiter writing a personalized interview invitation email.
Write a warm, professional email inviting the candidate to interview.
Reference their specific matching skills. Keep it under 200 words.
Return only the email body text (no subject line, no JSON).

User:
Candidate name: {name}
Role: {jd_title}
Matched skills: {matched_skills}

Write a personalized interview invitation email.
```

### 6. RAG Chat Synthesis Prompt
**Purpose:** Answer recruiter queries from retrieved resume context

```
System:
You are TalentScan's intelligent recruiter assistant. You have been provided with
relevant resume excerpts retrieved from the candidate database. Answer the recruiter's
question accurately based ONLY on this context. If the answer is not in the context,
say so clearly — do not hallucinate candidate details.
Be concise and structured. Use bullet points when listing multiple candidates.

User:
Context (retrieved resumes):
{retrieved_resume_profiles}

Recruiter question: {query}
```

### 7. NER Fallback Extraction Prompt
**Purpose:** Extract structured fields from ambiguous resume text when spaCy fails

```
System:
You are a resume parser. Extract structured information from the provided resume text.
Return ONLY valid JSON with keys:
- skills (list of strings)
- education (list of dicts with degree and institution)

User:
Resume text:
{resume_text}
```

---

## ⚙️ Configuration

### `.env` Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `DB_NAME` | Database name | `talentscan_db` |
| `OPENROUTER_API_KEY` | OpenRouter API key (optional) | `""` |
| `OPENROUTER_MODEL` | LLM model identifier | `openai/gpt-4o-mini` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `PORT` | API server port | `8000` |
| `JWT_SECRET` | JWT signing secret | `change_me` |

> **Note:** The app works fully without `OPENROUTER_API_KEY`. All LLM-dependent features gracefully fall back to TF-IDF/cosine similarity scoring.

### Supported File Types
| Format | Parser |
|--------|--------|
| `.pdf` | PyMuPDF |
| `.docx` | python-docx |
| `.doc` | python-docx |
| `.txt` | UTF-8 decode |

---

## 🎥 Demo

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a step-by-step screen-recording guide.

---

## 📄 License

MIT — see [LICENSE](LICENSE)
