import os, re, io, json, uuid, math, hashlib, logging, asyncio
from datetime import datetime, timezone
from typing import Any, Optional
from pathlib import Path
from functools import lru_cache
import csv
import numpy as np
import httpx
from dotenv import load_dotenv
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import (
    FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks,
    Query, Depends, Header
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure
import faiss
import pickle

load_dotenv(Path(__file__).parent / ".env")

MONGO_URI        = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME          = os.getenv("DB_NAME", "talentscan_db")
OPENROUTER_KEY   = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
CORS_ORIGINS     = os.getenv("CORS_ORIGINS", "*").split(",")
PORT             = int(os.getenv("PORT", 8000))
JWT_SECRET       = os.getenv("JWT_SECRET", "change_me")
UPLOAD_DIR       = Path(__file__).parent / "uploads"
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
EMBED_DIM        = 384
DUPLICATE_THRESHOLD = 0.95
UPLOAD_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("talentscan")

_mongo_client: Optional[MongoClient] = None
_db = None
_faiss_index = None
_faiss_meta: list[dict] = []
_embed_model = None

def get_db():
    global _mongo_client, _db
    if _db is None:
        _mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        _db = _mongo_client[DB_NAME]
        _ensure_indexes()
    return _db

def _ensure_indexes():
    db = _db
    db.resumes.create_index([("created_at", DESCENDING)])
    db.resumes.create_index([("email", ASCENDING)])
    db.job_descriptions.create_index([("created_at", DESCENDING)])
    db.scores.create_index([("resume_id", ASCENDING), ("jd_id", ASCENDING)])
    db.scores.create_index([("jd_id", ASCENDING), ("score", DESCENDING)])
    db.audit_logs.create_index([("timestamp", DESCENDING)])
    log.info("MongoDB indexes ensured.")

def get_faiss():
    global _faiss_index, _faiss_meta
    if _faiss_index is None:
        db = get_db()
        record = db.faiss_store.find_one({"_id": "main_index"})
        if record:
            idx_bytes = record["index"]
            meta_bytes = record["meta"]
            idx_array = np.frombuffer(idx_bytes, dtype=np.uint8)
            _faiss_index = faiss.deserialize_index(idx_array)
            _faiss_meta = pickle.loads(meta_bytes)
            log.info(f"FAISS index loaded from MongoDB: {_faiss_index.ntotal} vectors.")
        else:
            _faiss_index = faiss.IndexFlatIP(EMBED_DIM)
            _faiss_meta = []
            log.info("FAISS index created fresh.")
    return _faiss_index, _faiss_meta

def save_faiss():
    idx, meta = get_faiss()
    idx_bytes = faiss.serialize_index(idx).tobytes()
    meta_bytes = pickle.dumps(meta)
    
    try:
        db = get_db()
        db.faiss_store.update_one(
            {"_id": "main_index"},
            {"$set": {"index": idx_bytes, "meta": meta_bytes}},
            upsert=True
        )
    except Exception as e:
        log.warning(f"Failed to save FAISS to MongoDB (likely during shutdown): {e}")

def get_embed_model():
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
        log.info(f"Embedding model loaded: {EMBED_MODEL_NAME}")
    return _embed_model

class StructuredResume(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    skills: list[str] = []
    experience_years: float = 0.0
    experience_entries: list[dict] = []
    education: list[dict] = []
    raw_text: str = ""
    redacted_text: str = ""

class StructuredJD(BaseModel):
    title: str = ""
    required_skills: list[str] = []
    nice_to_have_skills: list[str] = []
    min_experience_years: float = 0.0
    education_requirements: list[str] = []
    raw_text: str = ""

class ScoreBreakdown(BaseModel):
    skills_score: float = 0.0
    experience_score: float = 0.0
    education_score: float = 0.0
    overall_score: float = 0.0
    justification: str = ""
    matched_skills: list[str] = []
    missing_required_skills: list[str] = []
    missing_nice_to_have_skills: list[str] = []
    used_llm: bool = False
    used_fallback: bool = False

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    history: list[ChatMessage] = []

class WeightSimulateRequest(BaseModel):
    jd_id: str
    skills_weight: float = 0.5
    experience_weight: float = 0.3
    education_weight: float = 0.2

class MatrixRequest(BaseModel):
    resume_ids: list[str] = []
    jd_ids: list[str] = []

class BiasRedactRequest(BaseModel):
    resume_id: str
    enabled: bool = True

def _parse_pdf(file_bytes: bytes) -> str:
    import fitz 
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)

def _parse_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(para.text for para in doc.paragraphs)

def parse_file(filename: str, file_bytes: bytes) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return _parse_pdf(file_bytes)
    elif ext in (".docx", ".doc"):
        return _parse_docx(file_bytes)
    else:
        return file_bytes.decode("utf-8", errors="replace")

_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            from spacy.cli import download
            download("en_core_web_sm")
            _nlp = spacy.load("en_core_web_sm")
    return _nlp

SKILL_PATTERNS = [
    "python","java","javascript","typescript","go","rust","c++","c#","ruby","php",
    "swift","kotlin","scala","r","matlab","sql","bash","shell","perl","haskell",
    "react","angular","vue","nextjs","django","flask","fastapi","spring","express",
    "tensorflow","pytorch","keras","scikit-learn","pandas","numpy","opencv",
    "nodejs","rails","laravel","dotnet",".net","jquery","bootstrap","tailwind",
    "aws","azure","gcp","google cloud","amazon web services","ec2","s3","lambda",
    "kubernetes","docker","terraform","ansible","jenkins","gitlab ci","github actions",
    "mongodb","postgresql","mysql","redis","elasticsearch","kafka","spark","hadoop",
    "snowflake","bigquery","airflow","dbt","tableau","power bi","looker",
    "machine learning","deep learning","nlp","computer vision","llm","bert","gpt",
    "transformers","rag","vector database","faiss","langchain","openai",
    "rest api","graphql","microservices","agile","scrum","devops","ci/cd","git",
]

DEGREE_PATTERNS = [
    r"b\.?s\.?c?\.?|bachelor",
    r"m\.?s\.?c?\.?|master",
    r"ph\.?d\.?|doctor",
    r"b\.?e\.?|b\.?tech",
    r"m\.?e\.?|m\.?tech",
    r"mba",
    r"associate",
    r"diploma",
]

DATE_PATTERN = re.compile(
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}"
    r"|(?:\d{1,2}[/\-]\d{4})"
    r"|(?:\d{4})",
    re.IGNORECASE,
)

def extract_skills_ner(text: str) -> list[str]:
    text_lower = text.lower()
    found = []
    for skill in SKILL_PATTERNS:
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, text_lower):
            found.append(skill)
    return list(set(found))

def extract_experience_entries(text: str) -> tuple[list[dict], float]:
    entries = []
    lines = text.split("\n")
    current = {}
    total_months = 0

    title_keywords = ["engineer","developer","analyst","manager","lead","director",
                      "scientist","architect","consultant","specialist","intern","officer"]

    for line in lines:
        line = line.strip()
        if not line:
            continue
        line_lower = line.lower()
        if any(kw in line_lower for kw in title_keywords) and len(line) < 120:
            if current:
                entries.append(current)
            current = {"title": line, "company": "", "dates": [], "description": ""}
        elif current:
            dates_found = DATE_PATTERN.findall(line)
            if dates_found:
                current["dates"].extend(dates_found)
            elif current.get("company") == "" and len(line) < 80 and len(line) > 2:
                current["company"] = line
            else:
                current["description"] = current.get("description", "") + " " + line

    if current:
        entries.append(current)

    years = list(map(int, re.findall(r"\b(19\d{2}|20\d{2})\b", text)))
    if len(years) >= 2:
        total_months = (max(years) - min(years)) * 12

    return entries, round(total_months / 12, 1)

def extract_education(text: str) -> list[dict]:
    education = []
    lines = text.split("\n")
    for i, line in enumerate(lines):
        line_lower = line.lower()
        for deg_pat in DEGREE_PATTERNS:
            if re.search(deg_pat, line_lower):
                context = " ".join(lines[max(0, i-1):i+3])
                education.append({
                    "degree": line.strip(),
                    "context": context.strip()[:200]
                })
                break
    return education

def extract_contact(text: str) -> tuple[str, str, str]:
    email = ""
    phone = ""
    name = ""

    email_match = re.search(r"[\w.+-]+@[\w-]+\.\w+", text)
    if email_match:
        email = email_match.group()

    phone_match = re.search(r"(\+?\d[\d\s\-().]{7,15}\d)", text)
    if phone_match:
        phone = phone_match.group().strip()

    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for line in lines[:5]:
        if "@" not in line and len(line.split()) in [2, 3] and not any(
            c.isdigit() for c in line
        ):
            name = line
            break

    return name, email, phone

async def extract_structured_resume(
    text: str, bias_redact: bool = False
) -> StructuredResume:
    name, email, phone = extract_contact(text)
    skills = extract_skills_ner(text)
    exp_entries, exp_years = extract_experience_entries(text)
    education = extract_education(text)

    redacted_text = text
    if bias_redact:
        redacted_text = apply_bias_redaction(text, name)

    if not skills and OPENROUTER_KEY:
        llm_data = await llm_extract_fields(text)
        skills = llm_data.get("skills", [])
        if not education:
            education = llm_data.get("education", [])

    return StructuredResume(
        name=name, email=email, phone=phone,
        skills=skills, experience_years=exp_years,
        experience_entries=exp_entries, education=education,
        raw_text=text, redacted_text=redacted_text
    )

async def extract_structured_jd(text: str) -> StructuredJD:
    skills = extract_skills_ner(text)
    required = skills[:max(1, len(skills)//2)]
    nice = skills[len(required):]
    exp_match = re.search(r"(\d+)\+?\s*(?:year|yr)", text, re.IGNORECASE)
    exp_years = float(exp_match.group(1)) if exp_match else 0.0

    title_match = re.search(r"(job title|position|role)[:\s]+([^\n]+)", text, re.IGNORECASE)
    title = title_match.group(2).strip() if title_match else text.split("\n")[0][:80]

    education = extract_education(text)

    return StructuredJD(
        title=title.strip(), required_skills=required, nice_to_have_skills=nice,
        min_experience_years=exp_years,
        education_requirements=[e.get("degree","") for e in education],
        raw_text=text
    )

def embed_text(text: str) -> np.ndarray:
    model = get_embed_model()
    vec = model.encode([text[:512]], normalize_embeddings=True)
    return vec.astype("float32")

def embed_texts(texts: list[str]) -> np.ndarray:
    model = get_embed_model()
    vecs = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
    return vecs.astype("float32")

def add_to_faiss(ref_id: str, ref_type: str, text: str) -> int:
    idx, meta = get_faiss()
    vec = embed_text(text)
    idx.add(vec)
    row = idx.ntotal - 1
    meta.append({"row": row, "ref_id": ref_id, "type": ref_type})
    save_faiss()
    return row

def faiss_search(query_text: str, top_k: int = 10, filter_type: str = "resume") -> list[dict]:
    idx, meta = get_faiss()
    if idx.ntotal == 0:
        return []
    vec = embed_text(query_text)
    k = min(top_k * 3, idx.ntotal)
    distances, indices = idx.search(vec, k)
    results = []
    for dist, i in zip(distances[0], indices[0]):
        if i < 0 or i >= len(meta):
            continue
        m = meta[i]
        if m["type"] == filter_type:
            results.append({"ref_id": m["ref_id"], "similarity": float(dist)})
        if len(results) >= top_k:
            break
    return results

def get_all_embeddings_2d() -> list[dict]:
    from sklearn.decomposition import PCA
    idx, meta = get_faiss()
    if idx.ntotal < 2:
        return []
    vecs = np.zeros((idx.ntotal, EMBED_DIM), dtype="float32")
    for i in range(idx.ntotal):
        vecs[i] = faiss.rev_swig_ptr(idx.get_xb(), idx.ntotal * EMBED_DIM)[i * EMBED_DIM: (i+1) * EMBED_DIM]

    try:
        vecs = np.vstack([idx.reconstruct(i) for i in range(idx.ntotal)])
    except Exception:
        return []

    n_components = min(2, vecs.shape[0], vecs.shape[1])
    pca = PCA(n_components=n_components)
    coords = pca.fit_transform(vecs)
    result = []
    for i, m in enumerate(meta):
        x = float(coords[i, 0]) if coords.shape[1] > 0 else 0.0
        y = float(coords[i, 1]) if coords.shape[1] > 1 else 0.0
        result.append({"ref_id": m["ref_id"], "type": m["type"], "x": x, "y": y})
    return result

def semantic_skill_match(candidate_skills: list[str], jd_skills: list[str]) -> tuple[list[str], list[str], float]:
    if not jd_skills:
        return [], [], 1.0
    if not candidate_skills:
        return [], jd_skills, 0.0

    model = get_embed_model()
    cand_vecs = model.encode(candidate_skills, normalize_embeddings=True)
    jd_vecs   = model.encode(jd_skills, normalize_embeddings=True)

    sim_matrix = np.dot(cand_vecs, jd_vecs.T)
    THRESHOLD = 0.70

    matched = []
    missing = []
    for j, jd_skill in enumerate(jd_skills):
        max_sim = sim_matrix[:, j].max() if sim_matrix.shape[0] > 0 else 0.0
        if max_sim >= THRESHOLD:
            matched.append(jd_skill)
        else:
            missing.append(jd_skill)

    score = len(matched) / len(jd_skills) if jd_skills else 1.0
    return matched, missing, round(score, 3)

async def call_llm(system: str, user: str, max_tokens: int = 1024) -> str:
    if not OPENROUTER_KEY:
        return ""
    url = "https://openrouter.ai/api/v1/chat/completions"
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://talentscan.local",
        "X-Title": "TalentScan",
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        log.warning(f"LLM call failed: {e}")
        return ""

async def llm_extract_fields(text: str) -> dict:
    system = (
        "You are a resume parser. Extract structured information from the provided resume text. "
        "Return ONLY valid JSON with keys: skills (list of strings), education (list of dicts with degree and institution)."
    )
    user = f"Resume text:\n{text[:3000]}"
    raw = await call_llm(system, user, max_tokens=512)
    try:
        return json.loads(raw)
    except Exception:
        return {"skills": [], "education": []}

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sk_cosine

def tfidf_score(resume_text: str, jd_text: str) -> float:
    if not resume_text or not jd_text:
        return 1.0
    try:
        vect = TfidfVectorizer(stop_words="english", max_features=5000)
        matrix = vect.fit_transform([resume_text, jd_text])
        sim = sk_cosine(matrix[0:1], matrix[1:2])[0][0]
        return round(1 + sim * 9, 2)
    except Exception:
        return 1.0

MATCH_SYSTEM_PROMPT = """
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
"""

async def score_resume_vs_jd(
    resume: StructuredResume,
    jd: StructuredJD,
    bias_redact: bool = False
) -> ScoreBreakdown:
    resume_text = resume.redacted_text if bias_redact else resume.raw_text
    jd_text = jd.raw_text

    matched_skills, missing_req, skills_sim = semantic_skill_match(
        resume.skills, jd.required_skills
    )
    _, missing_nice, _ = semantic_skill_match(
        resume.skills, jd.nice_to_have_skills
    )

    used_llm = False
    used_fallback = False

    user_prompt = (
        f"Compare the following resume with this job description and rate fit on 1–10 with justification.\n\n"
        f"=== RESUME ===\n{resume_text[:3000]}\n\n"
        f"=== JOB DESCRIPTION ===\n{jd_text[:2000]}"
    )
    llm_raw = await call_llm(MATCH_SYSTEM_PROMPT, user_prompt, max_tokens=600)

    if llm_raw:
        try:
            data = json.loads(llm_raw)
            verified_matched = zero_hallucination_guard(
                data.get("matched_skills", []), resume.raw_text
            )
            return ScoreBreakdown(
                skills_score=float(data.get("skills_score", 5.0)),
                experience_score=float(data.get("experience_score", 5.0)),
                education_score=float(data.get("education_score", 5.0)),
                overall_score=float(data.get("overall_score", 5.0)),
                justification=data.get("justification", ""),
                matched_skills=verified_matched,
                missing_required_skills=data.get("missing_required_skills", missing_req),
                missing_nice_to_have_skills=data.get("missing_nice_to_have_skills", missing_nice),
                used_llm=True,
                used_fallback=False,
            )
        except json.JSONDecodeError:
            log.warning("LLM returned non-JSON. Using fallback.")

    used_fallback = True
    fb_score = tfidf_score(resume_text, jd_text)
    exp_score = min(10.0, (resume.experience_years / max(jd.min_experience_years, 1)) * 10)
    edu_score = 7.0 if resume.education else 5.0
    composite = round(fb_score * 0.5 + exp_score * 0.3 + edu_score * 0.2, 2)

    return ScoreBreakdown(
        skills_score=round(fb_score, 2),
        experience_score=round(exp_score, 2),
        education_score=round(edu_score, 2),
        overall_score=min(10.0, composite),
        justification="Score computed via TF-IDF/cosine similarity (LLM unavailable).",
        matched_skills=matched_skills,
        missing_required_skills=missing_req,
        missing_nice_to_have_skills=missing_nice,
        used_llm=False,
        used_fallback=True,
    )

def zero_hallucination_guard(
    llm_claimed_skills: list[str], resume_text: str
) -> list[str]:
    verified = []
    text_lower = resume_text.lower()
    for skill in llm_claimed_skills:
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, text_lower):
            verified.append(skill)
    return verified

def check_authenticity(resume: StructuredResume) -> dict:
    flags = []
    warnings = []
    year_pairs = []
    text = resume.raw_text
    ranges = re.findall(r"((?:19|20)\d{2})\s*(?:–|-|to)\s*((?:19|20)\d{2}|present|current)", text, re.IGNORECASE)
    for start_str, end_str in ranges:
        start = int(start_str)
        end = datetime.now().year if end_str.lower() in ("present", "current") else int(end_str)
        year_pairs.append((start, end))

    year_pairs_sorted = sorted(year_pairs, key=lambda x: x[0])
    for i in range(len(year_pairs_sorted) - 1):
        s1, e1 = year_pairs_sorted[i]
        s2, e2 = year_pairs_sorted[i + 1]
        if s2 < e1:
            flags.append({
                "type": "OVERLAPPING_DATES",
                "detail": f"Employment period {s1}–{e1} overlaps with {s2}–{e2}. Please verify.",
                "severity": "HIGH"
            })

    for i in range(len(year_pairs_sorted) - 1):
        _, e1 = year_pairs_sorted[i]
        s2, _ = year_pairs_sorted[i + 1]
        gap = s2 - e1
        if gap >= 2:
            flags.append({
                "type": "EMPLOYMENT_GAP",
                "detail": f"Potential employment gap of ~{gap} year(s) between {e1} and {s2}.",
                "severity": "MEDIUM"
            })

    for entry in resume.experience_entries:
        title = entry.get("title", "").lower()
        desc = entry.get("description", "").lower()
        if "manager" in title and not any(kw in desc for kw in ["manage","lead","team","direct","oversee","coordinate"]):
            warnings.append({
                "type": "TITLE_DESCRIPTION_MISMATCH",
                "detail": f"Title '{entry.get('title','')}' implies management but description shows no leadership activity.",
                "severity": "LOW"
            })

    all_years = list(map(int, re.findall(r"\b(19\d{2}|20\d{2})\b", text)))
    if all_years:
        span = max(all_years) - min(all_years)
        if resume.experience_years > span + 5:
            flags.append({
                "type": "INFLATED_EXPERIENCE",
                "detail": f"Claimed experience ({resume.experience_years} years) exceeds career span ({span} years).",
                "severity": "HIGH"
            })

    return {
        "flags": flags,
        "warnings": warnings,
        "is_authentic": len(flags) == 0,
        "risk_level": "HIGH" if any(f["severity"] == "HIGH" for f in flags) else
                      "MEDIUM" if flags or warnings else "LOW"
    }

def is_duplicate(new_text: str, db) -> Optional[str]:
    content_hash = hashlib.sha256(new_text.encode('utf-8')).hexdigest()
    existing = db.resumes.find_one({"content_hash": content_hash})
    if existing:
        return str(existing["_id"])
    return None

JD_ANALYSIS_PROMPT = """
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
"""

async def analyze_jd_quality(jd_text: str) -> dict:
    raw = await call_llm(JD_ANALYSIS_PROMPT, f"Job Description:\n{jd_text[:2500]}", max_tokens=700)
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    issues = []
    biased_terms = ["rockstar", "ninja", "guru", "wizard", "killer", "aggressive", "young", "fresh"]
    for term in biased_terms:
        if term in jd_text.lower():
            issues.append({"type": "BIASED", "text": term, "suggestion": f"Remove '{term}' — it uses exclusionary language."})
    vague_terms = ["fast-paced", "self-starter", "passionate", "dynamic team"]
    for term in vague_terms:
        if term in jd_text.lower():
            issues.append({"type": "VAGUE", "text": term, "suggestion": "Replace with specific, measurable requirements."})
    return {
        "quality_score": max(1, 8 - len(issues)),
        "issues": issues,
        "improved_summary": "Analysis requires LLM. Basic heuristic applied."
    }

FEEDBACK_PROMPT = """
You are a supportive career coach. A candidate was not shortlisted for a role.
Given their score breakdown and missing skills, generate constructive, specific,
actionable feedback to help them improve their profile for similar roles.
Be encouraging but honest. Use bullet points. Return ONLY plain text (no JSON).
Keep it under 300 words.
"""

async def generate_candidate_feedback(
    candidate_name: str,
    score: ScoreBreakdown,
    jd_title: str
) -> str:
    user = (
        f"Candidate: {candidate_name}\n"
        f"Role applied for: {jd_title}\n"
        f"Overall score: {score.overall_score}/10\n"
        f"Skills score: {score.skills_score}/10\n"
        f"Experience score: {score.experience_score}/10\n"
        f"Education score: {score.education_score}/10\n"
        f"Missing required skills: {', '.join(score.missing_required_skills) or 'None'}\n"
        f"Missing nice-to-have skills: {', '.join(score.missing_nice_to_have_skills) or 'None'}\n"
        f"Justification: {score.justification}\n\n"
        f"Provide constructive feedback for this candidate."
    )
    result = await call_llm(FEEDBACK_PROMPT, user, max_tokens=400)
    if not result:
        missing = score.missing_required_skills or score.missing_nice_to_have_skills
        result = (
            f"Thank you for applying for the {jd_title} role, {candidate_name}.\n\n"
            f"Your profile scored {score.overall_score}/10 overall. "
            "To strengthen future applications consider:\n"
        )
        if missing:
            for skill in missing[:5]:
                result += f"• Gain hands-on experience with **{skill}**\n"
        result += "\nKeep building your skills and reapply as you grow!"
    return result

IQ_PROMPT = """
You are a senior technical interviewer. Based on the candidate's skill gaps
relative to the job description, generate 5-7 targeted interview questions.
Include mix of: technical depth, behavioral, and situational questions.
Return as a JSON array of strings. No markdown.
"""

INVITE_PROMPT = """
You are a professional recruiter writing a personalized interview invitation email.
Write a warm, professional email inviting the candidate to interview.
Reference their specific matching skills. Keep it under 200 words.
Return only the email body text (no subject line, no JSON).
"""

async def generate_interview_questions(
    missing_skills: list[str], jd_title: str
) -> list[str]:
    user = (
        f"Role: {jd_title}\n"
        f"Candidate skill gaps: {', '.join(missing_skills[:10]) or 'None identified'}\n\n"
        "Generate 5-7 targeted interview questions."
    )
    raw = await call_llm(IQ_PROMPT, user, max_tokens=500)
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            return [q.strip("- •") for q in raw.split("\n") if q.strip()]
    return [
        f"Describe your experience with {missing_skills[0] if missing_skills else 'the required technologies'}.",
        "Tell me about a challenging project you've worked on.",
        "How do you stay current with industry trends?",
        "Describe a situation where you had to learn a new skill quickly.",
        "Where do you see yourself in 3-5 years?",
    ]

async def generate_interview_invite(
    candidate_name: str, matched_skills: list[str], jd_title: str
) -> str:
    user = (
        f"Candidate name: {candidate_name}\n"
        f"Role: {jd_title}\n"
        f"Matched skills: {', '.join(matched_skills[:8]) or 'relevant experience'}\n\n"
        "Write a personalized interview invitation email."
    )
    result = await call_llm(INVITE_PROMPT, user, max_tokens=300)
    if not result:
        skills_str = ", ".join(matched_skills[:3]) if matched_skills else "your relevant experience"
        result = (
            f"Dear {candidate_name},\n\n"
            f"We were impressed by your application for the {jd_title} role, particularly your experience with {skills_str}.\n\n"
            "We'd love to invite you for an interview at your earliest convenience. "
            "Please reply with your availability for a 45-minute virtual session.\n\n"
            "Looking forward to speaking with you!\n\nBest regards,\nThe Talent Team"
        )
    return result

RAG_CHAT_PROMPT = """
You are TalentScan's intelligent recruiter assistant. You have been provided with
relevant resume excerpts retrieved from the candidate database. Answer the recruiter's
question accurately based ONLY on this context. If the answer is not in the context,
say so clearly — do not hallucinate candidate details.
Be concise and structured. Use bullet points when listing multiple candidates.
"""

async def rag_chat(query: str, history: list[ChatMessage]) -> str:
    top_results = faiss_search(query, top_k=5, filter_type="resume")
    db = get_db()
    context_parts = []
    for r in top_results:
        try:
            from bson import ObjectId
            resume = db.resumes.find_one({"_id": ObjectId(r["ref_id"])})
            if resume:
                context_parts.append(
                    f"Candidate: {resume.get('name', 'Unknown')}\n"
                    f"Skills: {', '.join(resume.get('skills', []))}\n"
                    f"Experience: {resume.get('experience_years', 0)} years\n"
                    f"Education: {resume.get('education', [{}])[0].get('degree','N/A') if resume.get('education') else 'N/A'}\n"
                    f"Score (if available): {resume.get('latest_score', 'N/A')}"
                )
        except Exception:
            pass

    if not context_parts:
        context_parts = ["No resumes found in the database yet. Please upload resumes first."]
    context = "\n\n---\n\n".join(context_parts)
    user_msg = f"Context (retrieved resumes):\n{context}\n\nRecruiter question: {query}"
    messages = []
    for msg in history[-4:]:
        messages.append({"role": msg.role, "content": msg.content})
    result = await call_llm(RAG_CHAT_PROMPT, user_msg, max_tokens=600)
    if not result:
        candidates = [r["ref_id"] for r in top_results]
        result = (
            f"Based on your query, I found {len(candidates)} potentially relevant candidate(s). "
            "LLM synthesis is unavailable — please check the dashboard for detailed profiles."
        )
    return result

GENDER_TERMS = re.compile(
    r"\b(mr\.?|mrs\.?|ms\.?|miss|dr\.?|prof\.?|sir|madam|he|she|his|her|him|hers|they|them|their)\b",
    re.IGNORECASE
)

AGE_TERMS = re.compile(
    r"\b(age[d]?:?\s*\d+|born\s+in\s+\d{4}|dob|date of birth|year of birth|\d{4}\s*born)\b",
    re.IGNORECASE
)

def apply_bias_redaction(text: str, name: str) -> str:
    result = text
    if name:
        result = re.sub(re.escape(name), "[CANDIDATE]", result, flags=re.IGNORECASE)
    result = GENDER_TERMS.sub("[PRONOUN]", result)
    result = AGE_TERMS.sub("[AGE_REDACTED]", result)
    result = re.sub(r"[\w.+-]+@[\w-]+\.\w+", "[EMAIL_REDACTED]", result)
    result = re.sub(r"(\+?\d[\d\s\-().]{7,15}\d)", "[PHONE_REDACTED]", result)
    return result

def audit_log(db, event_type: str, data: dict):
    entry = {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc),
        "data": data,
        "data_hash": hashlib.sha256(json.dumps(data, default=str, sort_keys=True).encode()).hexdigest()
    }
    db.audit_logs.insert_one(entry)

def get_skill_analytics(db) -> dict:
    pipeline_resumes = [
        {"$unwind": "$skills"},
        {"$group": {"_id": "$skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    resume_skills = list(db.resumes.aggregate(pipeline_resumes))

    pipeline_jd_req = [
        {"$unwind": "$required_skills"},
        {"$group": {"_id": "$required_skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    jd_skills = list(db.job_descriptions.aggregate(pipeline_jd_req))

    pipeline_scores = [
        {"$group": {
            "_id": "$jd_id",
            "avg_score": {"$avg": "$score"},
            "max_score": {"$max": "$score"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"avg_score": -1}}
    ]
    score_stats = list(db.scores.aggregate(pipeline_scores))

    return {
        "top_resume_skills": [{"skill": s["_id"], "count": s["count"]} for s in resume_skills],
        "top_jd_skills": [{"skill": s["_id"], "count": s["count"]} for s in jd_skills],
        "score_stats_by_jd": [
            {"jd_id": str(s["_id"]), "avg_score": round(s["avg_score"], 2),
             "max_score": round(s["max_score"], 2), "candidate_count": s["count"]}
            for s in score_stats
        ]
    }

def export_shortlist_csv(candidates: list[dict]) -> io.StringIO:
    output = io.StringIO()
    fieldnames = ["name", "email", "score", "skills_score", "experience_score",
                  "education_score", "matched_skills", "missing_required_skills", "justification"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for c in candidates:
        row = {
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "score": c.get("score", ""),
            "skills_score": c.get("skills_score", ""),
            "experience_score": c.get("experience_score", ""),
            "education_score": c.get("education_score", ""),
            "matched_skills": "; ".join(c.get("matched_skills", [])),
            "missing_required_skills": "; ".join(c.get("missing_required_skills", [])),
            "justification": c.get("justification", ""),
        }
        writer.writerow(row)
    output.seek(0)
    return output

from bson import ObjectId
from bson.errors import InvalidId

app = FastAPI(
    title="TalentScan API",
    description="AI-powered resume screening and candidate matching platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def serialize(doc) -> dict:
    if doc is None:
        return {}
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
        elif isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc

def obj_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")

@app.get("/api/health", tags=["system"])
async def health():
    db = get_db()
    try:
        db.command("ping")
        mongo_ok = True
    except Exception:
        mongo_ok = False
    idx, meta = get_faiss()
    return {
        "status": "ok",
        "mongodb": "connected" if mongo_ok else "disconnected",
        "faiss_vectors": idx.ntotal,
        "llm_configured": bool(OPENROUTER_KEY),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/api/resumes/upload", tags=["resumes"])
async def upload_resumes(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    bias_redact: bool = Form(False),
    jd_id: Optional[str] = Form(None),
    x_device_id: Optional[str] = Header(None)
):
    db = get_db()
    results = []

    async def process_file(f: UploadFile):
        file_bytes = await f.read()
        text = parse_file(f.filename, file_bytes)
        if not text.strip():
            return {"filename": f.filename, "error": "Could not extract text"}

        dup_id = is_duplicate(text, db)
        if dup_id:
            return {"filename": f.filename, "duplicate_of": dup_id, "skipped": True}

        structured = await extract_structured_resume(text, bias_redact=bias_redact)
        authenticity = check_authenticity(structured)

        doc = {
            "filename": f.filename,
            "content_hash": hashlib.sha256(text.encode('utf-8')).hexdigest(),
            "name": structured.name,
            "email": structured.email,
            "phone": structured.phone,
            "skills": structured.skills,
            "experience_years": structured.experience_years,
            "experience_entries": structured.experience_entries,
            "education": structured.education,
            "redacted_text": structured.redacted_text,
            "bias_redacted": bias_redact,
            "authenticity": authenticity,
            "created_at": datetime.now(timezone.utc),
            "versions": [],
            "device_id": x_device_id
        }

        if structured.email:
            existing = db.resumes.find_one({"email": structured.email})
            if existing:
                db.resumes.update_one(
                    {"_id": existing["_id"]},
                    {"$push": {"versions": {
                        "uploaded_at": existing.get("created_at"),
                        "skills": existing.get("skills", []),
                        "experience_years": existing.get("experience_years", 0),
                        "filename": existing.get("filename", "")
                    }}, "$set": {
                        k: v for k, v in doc.items() if k != "versions"
                    }}
                )
                resume_id = str(existing["_id"])
            else:
                result = db.resumes.insert_one(doc)
                resume_id = str(result.inserted_id)
        else:
            result = db.resumes.insert_one(doc)
            resume_id = str(result.inserted_id)

        add_to_faiss(resume_id, "resume", text)

        audit_log(db, "RESUME_UPLOADED", {
            "resume_id": resume_id,
            "filename": f.filename,
            "bias_redacted": bias_redact
        })

        if jd_id:
            background_tasks.add_task(_background_score, resume_id, jd_id, bias_redact)

        return {"filename": f.filename, "resume_id": resume_id, "name": structured.name,
                "skills_found": len(structured.skills), "experience_years": structured.experience_years,
                "authenticity_risk": authenticity["risk_level"]}

    for f in files:
        r = await process_file(f)
        results.append(r)

    return {"uploaded": len(results), "results": results}

async def _background_score(resume_id: str, jd_id: str, bias_redact: bool = False):
    db = get_db()
    try:
        resume_doc = db.resumes.find_one({"_id": obj_id(resume_id)})
        jd_doc = db.job_descriptions.find_one({"_id": obj_id(jd_id)})
        if not resume_doc or not jd_doc:
            return
        resume = StructuredResume(**{k: resume_doc.get(k, v) for k, v in StructuredResume().model_dump().items()})
        resume.raw_text = resume_doc.get("raw_text", "")
        resume.redacted_text = resume_doc.get("redacted_text", "")
        jd = StructuredJD(**{k: jd_doc.get(k, v) for k, v in StructuredJD().model_dump().items()})
        jd.raw_text = jd_doc.get("raw_text", "")

        breakdown = await score_resume_vs_jd(resume, jd, bias_redact)
        score_doc = {
            "resume_id": resume_id,
            "jd_id": jd_id,
            "score": breakdown.overall_score,
            **breakdown.model_dump(),
            "scored_at": datetime.now(timezone.utc),
            "bias_redacted": bias_redact,
        }
        db.scores.replace_one(
            {"resume_id": resume_id, "jd_id": jd_id},
            score_doc,
            upsert=True
        )
        db.resumes.update_one(
            {"_id": obj_id(resume_id)},
            {"$set": {"latest_score": breakdown.overall_score}}
        )
        audit_log(db, "RESUME_SCORED", {
            "resume_id": resume_id, "jd_id": jd_id,
            "score": breakdown.overall_score, "used_llm": breakdown.used_llm,
            "used_fallback": breakdown.used_fallback
        })
    except Exception as e:
        log.error(f"Background score failed: {e}")

@app.get("/api/resumes", tags=["resumes"])
async def list_resumes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    x_device_id: Optional[str] = Header(None)
):
    db = get_db()
    
    query = {}
    if x_device_id:
        query["device_id"] = x_device_id

    docs = list(db.resumes.find(query, {"raw_text": 0, "redacted_text": 0})
                .sort("created_at", DESCENDING)
                .skip(skip).limit(limit))
    return {"resumes": [serialize(d) for d in docs], "total": db.resumes.count_documents(query)}

@app.get("/api/resumes/{resume_id}", tags=["resumes"])
async def get_resume(resume_id: str, x_device_id: Optional[str] = Header(None)):
    db = get_db()
    doc = db.resumes.find_one({"_id": obj_id(resume_id)})
    if not doc:
        raise HTTPException(404, "Resume not found")
    return serialize(doc)

@app.delete("/api/resumes/{resume_id}", tags=["resumes"])
async def delete_resume(resume_id: str, x_device_id: Optional[str] = Header(None)):
    db = get_db()
    doc = db.resumes.find_one({"_id": obj_id(resume_id)})
    if doc and doc.get("device_id") and doc.get("device_id") != x_device_id:
        raise HTTPException(403, "Not authorized to delete this resume")

    result = db.resumes.delete_one({"_id": obj_id(resume_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Resume not found")
    db.scores.delete_many({"resume_id": resume_id})
    audit_log(db, "RESUME_DELETED", {"resume_id": resume_id})
    return {"deleted": True}

@app.post("/api/jd/upload", tags=["jd"])
async def upload_jd(
    title: str = Form(None),
    text: str = Form(None),
    file: Optional[UploadFile] = File(None)
):
    db = get_db()
    if file:
        file_bytes = await file.read()
        jd_text = parse_file(file.filename, file_bytes)
    elif text:
        jd_text = text
    else:
        raise HTTPException(400, "Provide either a file or text for the job description")

    structured = await extract_structured_jd(jd_text)
    quality = await analyze_jd_quality(jd_text)

    doc = {
        "title": title.strip() if title and title.strip() else structured.title,
        "required_skills": structured.required_skills,
        "nice_to_have_skills": structured.nice_to_have_skills,
        "min_experience_years": structured.min_experience_years,
        "education_requirements": structured.education_requirements,
        "raw_text": jd_text,
        "quality_analysis": quality,
        "created_at": datetime.now(timezone.utc),
    }
    result = db.job_descriptions.insert_one(doc)
    jd_id = str(result.inserted_id)
    add_to_faiss(jd_id, "jd", jd_text)
    audit_log(db, "JD_UPLOADED", {"jd_id": jd_id, "title": structured.title})
    return {"jd_id": jd_id, **serialize(doc)}

@app.get("/api/jd", tags=["jd"])
async def list_jds():
    db = get_db()
    docs = list(db.job_descriptions.find({}, {"raw_text": 0})
                .sort("created_at", DESCENDING))
    return {"jds": [serialize(d) for d in docs]}

@app.get("/api/jd/{jd_id}", tags=["jd"])
async def get_jd(jd_id: str):
    db = get_db()
    doc = db.job_descriptions.find_one({"_id": obj_id(jd_id)})
    if not doc:
        raise HTTPException(404, "JD not found")
    return serialize(doc)

@app.delete("/api/jd/{jd_id}", tags=["jd"])
async def delete_jd(jd_id: str):
    db = get_db()
    result = db.job_descriptions.delete_one({"_id": obj_id(jd_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "JD not found")
    audit_log(db, "JD_DELETED", {"jd_id": jd_id})
    return {"deleted": True}

@app.post("/api/match/score", tags=["matching"])
async def score_single(
    resume_id: str = Form(...),
    jd_id: str = Form(...),
    bias_redact: bool = Form(False)
):
    db = get_db()
    resume_doc = db.resumes.find_one({"_id": obj_id(resume_id)})
    jd_doc = db.job_descriptions.find_one({"_id": obj_id(jd_id)})
    if not resume_doc:
        raise HTTPException(404, "Resume not found")
    if not jd_doc:
        raise HTTPException(404, "JD not found")

    resume = StructuredResume(
        name=resume_doc.get("name",""), email=resume_doc.get("email",""),
        phone=resume_doc.get("phone",""), skills=resume_doc.get("skills",[]),
        experience_years=resume_doc.get("experience_years",0),
        experience_entries=resume_doc.get("experience_entries",[]),
        education=resume_doc.get("education",[]),
        raw_text=resume_doc.get("raw_text",""),
        redacted_text=resume_doc.get("redacted_text","")
    )
    jd = StructuredJD(
        title=jd_doc.get("title",""),
        required_skills=jd_doc.get("required_skills",[]),
        nice_to_have_skills=jd_doc.get("nice_to_have_skills",[]),
        min_experience_years=jd_doc.get("min_experience_years",0),
        education_requirements=jd_doc.get("education_requirements",[]),
        raw_text=jd_doc.get("raw_text","")
    )

    breakdown = await score_resume_vs_jd(resume, jd, bias_redact)

    score_doc = {
        "resume_id": resume_id, "jd_id": jd_id,
        "score": breakdown.overall_score,
        **breakdown.model_dump(),
        "scored_at": datetime.now(timezone.utc),
        "bias_redacted": bias_redact,
        "candidate_name": resume_doc.get("name",""),
        "candidate_email": resume_doc.get("email",""),
    }
    db.scores.replace_one({"resume_id": resume_id, "jd_id": jd_id}, score_doc, upsert=True)
    db.resumes.update_one({"_id": obj_id(resume_id)}, {"$set": {"latest_score": breakdown.overall_score}})

    audit_log(db, "RESUME_SCORED", {
        "resume_id": resume_id, "jd_id": jd_id,
        "score": breakdown.overall_score, "used_llm": breakdown.used_llm
    })

    questions = await generate_interview_questions(
        breakdown.missing_required_skills, jd.title
    )

    return {
        **breakdown.model_dump(),
        "resume_id": resume_id,
        "jd_id": jd_id,
        "candidate_name": resume_doc.get("name",""),
        "interview_questions": questions,
    }

@app.post("/api/match/bulk", tags=["matching"])
async def score_bulk(
    background_tasks: BackgroundTasks,
    jd_id: str = Form(...),
    resume_ids: str = Form(""),
    bias_redact: bool = Form(False)
):
    db = get_db()
    ids = [r.strip() for r in resume_ids.split(",") if r.strip()]
    if not ids:
        all_docs = list(db.resumes.find({}, {"_id": 1}))
        ids = [str(d["_id"]) for d in all_docs]

    for resume_id in ids:
        background_tasks.add_task(_background_score, resume_id, jd_id, bias_redact)

    audit_log(db, "BULK_SCORE_STARTED", {"jd_id": jd_id, "resume_count": len(ids)})
    return {
        "message": f"Scoring {len(ids)} resumes in background",
        "jd_id": jd_id, "resume_ids": ids
    }

@app.post("/api/match/matrix", tags=["matching"])
async def score_matrix(
    background_tasks: BackgroundTasks,
    request: MatrixRequest
):
    db = get_db()
    resume_ids = request.resume_ids or [str(d["_id"]) for d in db.resumes.find({}, {"_id": 1})]
    jd_ids = request.jd_ids or [str(d["_id"]) for d in db.job_descriptions.find({}, {"_id": 1})]
    matrix = []
    for r_id in resume_ids:
        row = {"resume_id": r_id}
        for j_id in jd_ids:
            score_doc = db.scores.find_one({"resume_id": r_id, "jd_id": j_id})
            if score_doc:
                row[j_id] = score_doc.get("score", None)
            else:
                row[j_id] = None
                background_tasks.add_task(_background_score, r_id, j_id)
        matrix.append(row)

    for row in matrix:
        r_doc = db.resumes.find_one({"_id": obj_id(row["resume_id"])}, {"name": 1})
        row["candidate_name"] = r_doc.get("name", "Unknown") if r_doc else "Unknown"

    jd_titles = {}
    for j_id in jd_ids:
        jd_doc = db.job_descriptions.find_one({"_id": obj_id(j_id)}, {"title": 1})
        jd_titles[j_id] = jd_doc.get("title", j_id) if jd_doc else j_id

    return {"matrix": matrix, "resume_ids": resume_ids, "jd_ids": jd_ids, "jd_titles": jd_titles}

@app.get("/api/analysis/{jd_id}", tags=["analysis"])
async def get_analysis(
    jd_id: str,
    limit: int = Query(50)
):
    db = get_db()
    docs = list(db.scores.find({"jd_id": jd_id}).limit(limit))
    return {"shortlist": [serialize(d) for d in docs], "total": len(docs)}



@app.post("/api/chat", tags=["chat"])
async def chat(req: ChatRequest):
    response = await rag_chat(req.query, req.history)
    audit_log(get_db(), "CHAT_QUERY", {"query": req.query[:200]})
    return {"response": response, "query": req.query}

@app.post("/api/feedback/{resume_id}/{jd_id}", tags=["feedback"])
async def get_feedback(resume_id: str, jd_id: str):
    db = get_db()
    score_doc = db.scores.find_one({"resume_id": resume_id, "jd_id": jd_id})
    resume_doc = db.resumes.find_one({"_id": obj_id(resume_id)})
    jd_doc = db.job_descriptions.find_one({"_id": obj_id(jd_id)})
    if not score_doc or not resume_doc or not jd_doc:
        raise HTTPException(404, "Score record not found. Please score first.")

    breakdown = ScoreBreakdown(
        skills_score=score_doc.get("skills_score",0),
        experience_score=score_doc.get("experience_score",0),
        education_score=score_doc.get("education_score",0),
        overall_score=score_doc.get("score",0),
        justification=score_doc.get("justification",""),
        matched_skills=score_doc.get("matched_skills",[]),
        missing_required_skills=score_doc.get("missing_required_skills",[]),
        missing_nice_to_have_skills=score_doc.get("missing_nice_to_have_skills",[]),
    )

    feedback = await generate_candidate_feedback(
        resume_doc.get("name","Candidate"), breakdown, jd_doc.get("title","the role")
    )

    db.feedback.replace_one(
        {"resume_id": resume_id, "jd_id": jd_id},
        {"resume_id": resume_id, "jd_id": jd_id, "feedback": feedback,
         "generated_at": datetime.now(timezone.utc)},
        upsert=True
    )
    return {"feedback": feedback, "resume_id": resume_id, "jd_id": jd_id}

@app.post("/api/interview-invite/{resume_id}/{jd_id}", tags=["feedback"])
async def get_interview_invite(resume_id: str, jd_id: str):
    db = get_db()
    score_doc = db.scores.find_one({"resume_id": resume_id, "jd_id": jd_id})
    resume_doc = db.resumes.find_one({"_id": obj_id(resume_id)})
    jd_doc = db.job_descriptions.find_one({"_id": obj_id(jd_id)})
    if not score_doc or not resume_doc:
        raise HTTPException(404, "Score record not found.")

    invite = await generate_interview_invite(
        resume_doc.get("name","Candidate"),
        score_doc.get("matched_skills",[]),
        jd_doc.get("title","the role") if jd_doc else "the role"
    )
    return {"invite": invite, "resume_id": resume_id}

@app.post("/api/interview-questions/{resume_id}/{jd_id}", tags=["feedback"])
async def get_interview_questions(resume_id: str, jd_id: str):
    db = get_db()
    score_doc = db.scores.find_one({"resume_id": resume_id, "jd_id": jd_id})
    jd_doc = db.job_descriptions.find_one({"_id": obj_id(jd_id)})
    if not score_doc:
        raise HTTPException(404, "Score record not found.")

    questions = await generate_interview_questions(
        score_doc.get("missing_required_skills",[]),
        jd_doc.get("title","the role") if jd_doc else "the role"
    )
    return {"questions": questions, "resume_id": resume_id, "jd_id": jd_id}

@app.get("/api/authenticity/{resume_id}", tags=["analysis"])
async def get_authenticity(resume_id: str):
    db = get_db()
    doc = db.resumes.find_one({"_id": obj_id(resume_id)})
    if not doc:
        raise HTTPException(404, "Resume not found")
    return doc.get("authenticity", {"flags": [], "warnings": [], "is_authentic": True, "risk_level": "LOW"})

@app.get("/api/analytics/skills", tags=["analytics"])
async def analytics_skills():
    db = get_db()
    return get_skill_analytics(db)



@app.on_event("startup")
async def startup_event():
    log.info("TalentScan API starting up...")
    get_db()
    get_faiss()
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, get_embed_model)
    log.info("TalentScan API ready.")

@app.on_event("shutdown")
async def shutdown_event():
    log.info("TalentScan API shutting down...")
    if _mongo_client:
        _mongo_client.close()
    save_faiss()
    log.info("Resources released.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=True)
