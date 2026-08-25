## What is TalentScan?

TalentScan is an AI-powered resume screening and candidate matching platform designed to end the manual parsing of resumes. It transforms technical recruiting into a seamless, data-driven experience where recruiters can upload job descriptions and resumes in bulk, and receive AI-curated shortlist recommendations with ranked scores, transparent justifications, and skill-gap analysis.

## Key Features

👥 **Core Processing Engine**
- **Multi-Format Support:** Upload PDF, DOCX, and TXT resumes (single or bulk) alongside job descriptions.
- **Data Extraction:** Extracts structured data like skills, experience, and education for seamless parsing.
- **Smart Scoring:** LLM-based match score (1–10) with detailed justification and breakdown per candidate.

🤖 **Hybrid AI & Vector Recommendations**
- **Semantic Skill Matching:** Utilizes sentence-transformers embeddings for deep contextual skill matching.
- **Hybrid Parsing System:** Combines spaCy NER with an LLM fallback for handling ambiguous resumes.
- **TF-IDF Fallback:** Ensures system availability with TF-IDF/cosine fallback when the LLM is unavailable or rate-limited.
- **Duplicate Detection:** Identifies duplicate candidates via embedding cosine similarity.

🛡️ **Guardian & Safeguard Systems**
- **Zero-Hallucination Safeguard:** Ensures LLM skill claims are strictly verified against the original resume text.
- **JD Quality & Bias Analyzer:** Scans job descriptions for vague or exclusionary language and stacked requirements.
- **Resume Authenticity Checker:** Detects date overlaps, gaps, and title mismatches to ensure candidate integrity.
- **Bias-Reduction Mode:** Automatically redacts name, gender pronouns, and age before scoring to promote fair hiring.

📍 **Advanced Analytics & Visualization**
- **Skill Demand Dashboard:** View the most common skills and average scores per role.
- **Embedding Space Visualizer:** Explore candidate clusters via a 2D PCA scatter plot.
- **N×M Batch Matching Matrix:** Generates a full heatmap comparing all uploaded resumes against all active JDs.
- **Live Weight Simulator:** Instantly re-rank candidates via intuitive weight sliders.

🎬 **Automated Recruiter Tools**
- **Auto-Generated Interview Questions:** Creates targeted questions based on identified candidate skill gaps.
- **Candidate Feedback Generator:** Provides constructive improvement suggestions for candidates.
- **Auto-Drafted Interview Invite:** Automatically drafts personalized emails for shortlisted candidates.

📝 **Interactive RAG Chat Assistant**
- **Natural-Language Search:** Query your entire candidate pool using natural language to instantly find the right fit.

## Tech Stack

**Backend:**
- FastAPI (Python web framework)
- MongoDB for robust data storage
- FAISS (Facebook AI Similarity Search) for high-performance vector indexing
- spaCy for Named Entity Recognition (NER)
- sentence-transformers for generating semantic embeddings
- OpenRouter API (LLM reasoning and generation)
- PyMuPDF and python-docx for document parsing

**Frontend:**
- React for UI components
- Tailwind CSS & Glassmorphism design system for modern styling
- Axios for API communication
- Recharts for data visualization (AreaChart)

## Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB running on `localhost:27017`
- OpenRouter API Key (optional, for LLM features)

### Installation Steps

1. **Clone the repository**

2. **Set up backend virtual environment**
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Linux/macOS: source venv/bin/activate
```

3. **Install backend dependencies and models**
```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

4. **Configure Environment**
Create a `.env` file in the backend folder using `.env.example`.

5. **Run backend server**
```bash
python server.py
# OR: uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

6. **Open a new terminal and install frontend dependencies**
```bash
cd frontend
yarn install
yarn start
```

## API Endpoints

**Core Features:**
- GET /api/health - System health check
- POST /api/resumes/upload - Upload PDF/DOCX/TXT resumes
- GET /api/resumes - List all resumes
- GET /api/resumes/{id} - Get resume detail
- DELETE /api/resumes/{id} - Delete resume

**Job Descriptions:**
- POST /api/jd/upload - Upload/paste job description
- GET /api/jd - List all JDs
- GET /api/jd/{id} - Get JD detail
- DELETE /api/jd/{id} - Delete JD

**Matching & Analytics:**
- POST /api/match/score - Score 1 resume vs 1 JD
- POST /api/match/bulk - Score N resumes vs 1 JD (async)
- POST /api/match/matrix - N×M matching matrix
- POST /api/match/weight-simulate - Re-rank with custom weights
- GET /api/shortlist/{jd_id} - Get ranked shortlist

**Advanced Tools:**
- POST /api/chat - RAG chat query
- POST /api/feedback/{resume_id}/{jd_id} - Generate candidate feedback
- POST /api/interview-invite/{resume_id}/{jd_id} - Draft interview invite
- POST /api/interview-questions/{resume_id}/{jd_id} - Generate interview questions
- GET /api/authenticity/{id} - Get authenticity analysis
- GET /api/analytics/skills - Skill demand analytics
- GET /api/analytics/embeddings - 2D embedding coordinates
- GET /api/analytics/score-distribution/{jd_id} - Score histogram
- GET /api/audit - Audit log
- GET /api/export/shortlist/{jd_id} - Export shortlist as CSV

## Configuration Details

**MongoDB Setup:**
- Ensure MongoDB is running on `localhost:27017` or update the `MONGO_URI` in `.env`.
- Database Name defaults to `talentscan_db`.

**OpenRouter API:**
1. Sign up at openrouter.ai to get your API key.
2. Add it to `.env` as `OPENROUTER_API_KEY`.
3. Used for: matching justification, JD bias checking, candidate feedback, interview questions, and RAG chat.

**Fallback Strategy:**
- The app works fully without `OPENROUTER_API_KEY`. All LLM-dependent features gracefully fall back to TF-IDF/cosine similarity scoring and basic keyword matching.

## 🎥 Demo

Check out the live demonstration of TalentScan in action. See how the platform seamlessly screens bulk resumes, analyzes skill gaps, and lets you interactively chat with your candidate pool.

[Watch the Demo Here](#)

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

© 2026 Eswar Vutukuri

## Acknowledgments

This project was developed under the guidance of **Prof. M. Sucharitha**, **VIT-AP University**. I sincerely thank my professor for their invaluable guidance, mentorship, and continuous support throughout the development of this project.

Thanks to OpenRouter for providing accessible AI reasoning models, MongoDB for the database, FastAPI for the high-performance web framework, and the React community for the UI ecosystem. I thank you from the bottom of my heart for helping me complete this project.
