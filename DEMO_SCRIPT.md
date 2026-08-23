# TalentScan — Demo Recording Script 🎬

> **Duration target:** 2–3 minutes  
> **Format:** Screen recording with voiceover  
> **Resolution:** 1920×1080 recommended

---

## Pre-Recording Checklist

- [ ] MongoDB running locally: `mongod`
- [ ] Backend running: `cd backend && python server.py`
- [ ] Frontend running: `cd frontend && npm start`
- [ ] Browser open at `http://localhost:3000`
- [ ] Sample resumes prepared (3–5 PDF/DOCX files)
- [ ] Sample job description text ready

---

## Scene 1 — Dashboard Overview (0:00–0:20)

**What to show:** Landing on the Dashboard page.

**Script:**
> "Welcome to TalentScan — an AI-powered resume screening platform. Here on the dashboard you can see a high-level view: total resumes in the system, open roles, shortlisted candidates, and the average match score."

**Actions:**
1. Open browser at `http://localhost:3000`
2. Point to the 4 stat cards at the top
3. Point to the sidebar navigation items

---

## Scene 2 — Upload Resumes (0:20–0:55)

**What to show:** Uploading resumes + JD with quality analysis.

**Script:**
> "Let me upload some candidate resumes. TalentScan accepts PDF, Word documents, and plain text. I'll drag and drop multiple files at once."

**Actions:**
1. Click **Upload** in the sidebar
2. Drag 3–5 PDF resumes into the dropzone
3. Show the file list appearing
4. Enable the **Bias-reduction mode** toggle
   > "This blind screening mode automatically redacts names, gender pronouns, and age indicators before AI scoring."
5. Click **Upload Resumes**
6. Show the upload results cards appearing — point to skill count, experience years, authenticity risk badge

**Script (JD):**
> "Now I'll add a job description. TalentScan immediately analyzes it for vague language and biased phrasing."

7. Paste a sample JD into the text area
8. Click **Save & Analyze JD**
9. Show the Quality Analysis panel — point to quality score and any issues found

---

## Scene 3 — AI Scoring & Shortlist (0:55–1:25)

**What to show:** Bulk scoring, shortlist view, sub-score breakdown.

**Script:**
> "Now let's score all candidates against this job description with a single click."

**Actions:**
1. Click **Dashboard** in sidebar
2. Select the JD from the dropdown
3. Click **Score All Resumes** button
4. Wait ~3 seconds, then click **Refresh**
5. Show the ranked shortlist cards appearing
   > "Each candidate is ranked by their overall match score, computed by our AI. The score ring shows the overall rating, and the bars below break it into Skills Match, Experience, and Education sub-scores."
6. Point to the matched skill tags (green) and missing skill tags (red)
7. Point to the AI justification text
8. Point to the **Weight Simulator** panel on the right
   > "Here's a live weight simulator — I can drag these sliders to instantly re-rank candidates without calling the AI again."
9. Move the Skills slider to 80%, watch the list re-order

---

## Scene 4 — Candidate Detail (1:25–1:55)

**What to show:** Authenticity checker, feedback generator, interview invite.

**Actions:**
1. Click **View Profile** on the top candidate
2. Show the full candidate page:
   - Profile header with score ring
   - Score breakdown section
   - Skill gap panel (matched/missing)
   - Experience timeline entries
   - **Authenticity Check** panel
     > "TalentScan automatically scans for red flags: overlapping employment dates, unexplained gaps, and title-vs-description mismatches. This candidate shows no critical flags."
3. Click **Draft Invite**
   > "One click generates a personalized interview invitation email that references this candidate's specific skills."
4. Show the generated email, click **Copy Email**
5. Click **Feedback** button
   > "For candidates who weren't shortlisted, TalentScan generates constructive, specific improvement feedback."
6. Show the feedback text

---

## Scene 5 — Recruiter Chat (1:55–2:20)

**What to show:** RAG chat assistant.

**Script:**
> "Here's one of TalentScan's signature features — a RAG-powered AI chat assistant that lets recruiters ask natural language questions about the entire candidate pool."

**Actions:**
1. Click **AI Chat** in sidebar
2. Type: `Show me candidates with Python and React experience`
3. Show the response appearing with candidate summaries
4. Type: `Who has the most years of experience?`
5. Show the response

---

## Scene 6 — Analytics (2:20–2:50)

**What to show:** Skill demand charts, embedding visualizer, heatmap.

**Actions:**
1. Click **Analytics** in sidebar
2. Show the **Top Skills** horizontal bar chart
   > "This shows the most common skills across our entire candidate pool."
3. Show the **Score Distribution** area chart
4. Scroll down to the **Embedding Space Visualizer**
   > "This 2D scatter plot shows where each candidate's resume embedding sits relative to the job description. Candidates closer to the JD dot are semantically more similar."
5. Hover over a few dots to show tooltips
6. Scroll to the **N×M Matching Matrix**
   > "This heatmap shows every candidate scored against every open role — green cells indicate strong matches, red indicates poor fit. Perfect for internal mobility scenarios."
7. Click **Compute Full Matrix**

---

## Scene 7 — Audit Log (2:50–3:00)

**What to show:** Transparency and traceability.

**Actions:**
1. Click **Audit Log** in sidebar
2. Show the table of events with timestamps
   > "Every scoring decision is logged with a tamper-evident SHA-256 hash for full auditability and regulatory compliance."

---

## Closing (3:00)

> "TalentScan combines state-of-the-art AI screening with recruiter-friendly explainability, bias reduction, and enterprise-grade audit trails. All running locally with graceful fallback to TF-IDF scoring when the LLM is unavailable. Thank you!"

---

## Sample Job Description (use in Scene 2)

```
Senior Full Stack Engineer

We are looking for an experienced Full Stack Engineer to join our team.

Requirements:
- 4+ years of professional software development experience
- Strong proficiency in Python (FastAPI or Django) and JavaScript/TypeScript
- Experience with React or Vue for frontend development
- Proficiency with SQL and NoSQL databases (PostgreSQL, MongoDB)
- Experience with cloud platforms (AWS, GCP, or Azure)
- Familiarity with Docker and Kubernetes
- Knowledge of REST API design and microservices architecture
- Experience with CI/CD pipelines (GitHub Actions, Jenkins)

Nice to have:
- Experience with machine learning or data science workflows
- Knowledge of vector databases (FAISS, Pinecone, Chroma)
- Contributions to open source projects

Education:
Bachelor's degree in Computer Science or equivalent practical experience.

We offer competitive compensation, remote-first culture, and excellent growth opportunities.
```
