import os, re, io, json, uuid, hashlib, logging, asyncio
from datetime import datetime, timezone
from typing import Any, Optional
from pathlib import Path
import csv
import httpx
from dotenv import load_dotenv
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import (
    FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks,
    Query, Header
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure

load_dotenv(Path(__file__).parent / ".env")

MONGO_URI        = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME          = os.getenv("DB_NAME", "talentscan_db")
OPENROUTER_KEY   = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
CORS_ORIGINS     = os.getenv("CORS_ORIGINS", "*").split(",")
PORT             = int(os.getenv("PORT", 8000))
UPLOAD_DIR       = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("talentscan")

_mongo_client: Optional[MongoClient] = None
_db = None

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
    db.resumes.create_index([("content_hash", ASCENDING)])
    db.job_descriptions.create_index([("created_at", DESCENDING)])
    db.scores.create_index([("resume_id", ASCENDING), ("jd_id", ASCENDING)])
    db.scores.create_index([("jd_id", ASCENDING), ("score", DESCENDING)])
    db.audit_logs.create_index([("timestamp", DESCENDING)])
    log.info("MongoDB indexes ensured.")

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

def is_duplicate(new_text: str, db) -> Optional[str]:
    content_hash = hashlib.sha256(new_text.encode("utf-8")).hexdigest()
    existing = db.resumes.find_one({"content_hash": content_hash})
    if existing:
        return str(existing["_id"])
    return None

ANALYZE_SYSTEM_PROMPT = """You are an expert technical recruiter and hiring specialist.
You will receive a candidate's resume text and a job description text.
Analyze the candidate's fit for the role thoroughly and return ONLY valid JSON — no markdown, no commentary.

Return this exact JSON structure:
{
  "overall_score": <float 1-10>,
  "skills_score": <float 1-10>,
  "experience_score": <float 1-10>,
  "education_score": <float 1-10>,
  "justification": "<2-3 sentence summary of fit>",
  "matched_skills": ["skill1", "skill2"],
  "missing_required_skills": ["skill3"],
  "missing_nice_to_have_skills": ["skill4"],
  "candidate_name": "<extracted full name or empty string>",
  "experience_years": <float, total years of experience>,
  "top_skills": ["skill1", "skill2", "skill3"],
  "education_summary": "<degree and institution if found, else empty string>",
  "feedback": "<constructive 2-4 sentence feedback for the candidate on how to improve their profile>",
  "interview_questions": ["question1", "question2", "question3", "question4", "question5"]
}"""

async def call_llm(system: str, user: str, max_tokens: int = 4000) -> str:
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
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        log.warning(f"LLM call failed: {e}")
        return ""

async def ai_analyze_resume(resume_text: str, jd_text: str) -> dict:
    user_prompt = (
        f"=== RESUME ===\n{resume_text[:4000]}\n\n"
        f"=== JOB DESCRIPTION ===\n{jd_text[:3000]}"
    )
    raw = await call_llm(ANALYZE_SYSTEM_PROMPT, user_prompt, max_tokens=4000)

    if raw:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)
        try:
            return json.loads(cleaned)
        except Exception as e:
            log.warning(f"AI response JSON parse failed: {e}\nRaw: {raw[:500]}")

    return {
        "overall_score": 5.0,
        "skills_score": 5.0,
        "experience_score": 5.0,
        "education_score": 5.0,
        "justification": "AI analysis unavailable. Please check your OpenRouter API key configuration.",
        "matched_skills": [],
        "missing_required_skills": [],
        "missing_nice_to_have_skills": [],
        "candidate_name": "",
        "experience_years": 0.0,
        "top_skills": [],
        "education_summary": "",
        "feedback": "AI analysis unavailable. Please configure the OpenRouter API key.",
        "interview_questions": [
            "Describe your most relevant project experience.",
            "What technical skills do you bring to this role?",
            "How do you approach learning new technologies?",
            "Describe a challenging problem you solved at work.",
            "Where do you see your career heading in the next few years?"
        ],
        "used_fallback": True
    }

def audit_log(db, event_type: str, data: dict):
    entry = {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc),
        "data": data,
    }
    db.audit_logs.insert_one(entry)

def get_skill_analytics(db) -> dict:
    pipeline_resume_skills = [
        {"$unwind": "$top_skills"},
        {"$group": {"_id": "$top_skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    resume_skills = list(db.scores.aggregate(pipeline_resume_skills))

    pipeline_jd_skills = [
        {"$unwind": "$missing_required_skills"},
        {"$group": {"_id": "$missing_required_skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    jd_skills = list(db.scores.aggregate(pipeline_jd_skills))

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
        "top_resume_skills": [{"skill": s["_id"], "count": s["count"]} for s in resume_skills if s["_id"]],
        "top_jd_skills": [{"skill": s["_id"], "count": s["count"]} for s in jd_skills if s["_id"]],
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
            "name": c.get("candidate_name", ""),
            "email": c.get("candidate_email", ""),
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

app = FastAPI(
    title="TalentScan API",
    description="AI-powered resume screening and candidate matching platform",
    version="2.0.0"
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
    return {
        "status": "ok",
        "mongodb": "connected" if mongo_ok else "disconnected",
        "llm_configured": bool(OPENROUTER_KEY),
        "llm_model": OPENROUTER_MODEL,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/api/resumes/upload", tags=["resumes"])
async def upload_resumes(
    files: list[UploadFile] = File(...),
    bias_redact: bool = Form(False),
    jd_id: Optional[str] = Form(None),
    x_device_id: Optional[str] = Header(None)
):
    db = get_db()
    results = []

    for f in files:
        try:
            file_bytes = await f.read()
            text = parse_file(f.filename, file_bytes)
            if not text.strip():
                results.append({"filename": f.filename, "error": "Could not extract text from file"})
                continue

            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            existing_dup = db.resumes.find_one({"content_hash": content_hash})
            if existing_dup:
                results.append({
                    "filename": f.filename,
                    "duplicate_of": str(existing_dup["_id"]),
                    "skipped": True,
                    "resume_id": str(existing_dup["_id"])
                })
                continue

            doc = {
                "filename": f.filename,
                "content_hash": content_hash,
                "raw_text": text,
                "bias_redacted": bias_redact,
                "created_at": datetime.now(timezone.utc),
                "device_id": x_device_id,
                "candidate_name": "",
                "top_skills": [],
                "experience_years": 0.0,
                "education_summary": "",
            }

            result = db.resumes.insert_one(doc)
            resume_id = str(result.inserted_id)

            audit_log(db, "RESUME_UPLOADED", {
                "resume_id": resume_id,
                "filename": f.filename,
            })

            results.append({
                "filename": f.filename,
                "resume_id": resume_id,
                "success": True
            })
        except Exception as e:
            log.error(f"Error processing {f.filename}: {e}")
            results.append({"filename": f.filename, "error": str(e)})

    return {"uploaded": len([r for r in results if r.get("success") or r.get("skipped")]), "results": results}

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
    docs = list(db.resumes.find(query, {"raw_text": 0})
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
    title: str = Form(...),
    text: str = Form(None),
    file: Optional[UploadFile] = File(None)
):
    db = get_db()
    if file:
        file_bytes = await file.read()
        jd_text = parse_file(file.filename, file_bytes)
    elif text and text.strip():
        jd_text = text.strip()
    else:
        raise HTTPException(400, "Provide either a file or text for the job description")

    if not title or not title.strip():
        raise HTTPException(400, "Job title is required")

    doc = {
        "title": title.strip(),
        "raw_text": jd_text,
        "created_at": datetime.now(timezone.utc),
    }
    result = db.job_descriptions.insert_one(doc)
    jd_id = str(result.inserted_id)
    audit_log(db, "JD_UPLOADED", {"jd_id": jd_id, "title": title.strip()})
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
    raise HTTPException(403, "Job Descriptions cannot be deleted once added.")

@app.post("/api/analyze", tags=["analysis"])
async def analyze_resume(
    resume_id: str = Form(...),
    jd_id: str = Form(...)
):
    db = get_db()

    resume_doc = db.resumes.find_one({"_id": obj_id(resume_id)})
    jd_doc = db.job_descriptions.find_one({"_id": obj_id(jd_id)})

    if not resume_doc:
        raise HTTPException(404, "Resume not found")
    if not jd_doc:
        raise HTTPException(404, "Job description not found")

    resume_text = resume_doc.get("raw_text", "")
    jd_text = jd_doc.get("raw_text", "")

    if not resume_text:
        raise HTTPException(400, "Resume has no text content")
    if not jd_text:
        raise HTTPException(400, "Job description has no text content")
    if not OPENROUTER_KEY:
        raise HTTPException(503, "OpenRouter API key not configured. Please add OPENROUTER_API_KEY to your .env file.")

    ai_result = await ai_analyze_resume(resume_text, jd_text)

    ai_name = ai_result.get("candidate_name", "").strip()
    device_id = resume_doc.get("device_id")
    
    if ai_name and device_id:
        existing_resume = db.resumes.find_one({
            "device_id": device_id,
            "candidate_name": {"$regex": f"^{ai_name}$", "$options": "i"},
            "_id": {"$ne": obj_id(resume_id)}
        })
        
        if existing_resume:
            db.resumes.update_one(
                {"_id": existing_resume["_id"]},
                {"$set": {
                    "raw_text": resume_text,
                    "filename": resume_doc.get("filename"),
                    "content_hash": resume_doc.get("content_hash"),
                    "experience_years": ai_result.get("experience_years", 0.0),
                    "education_summary": ai_result.get("education_summary", ""),
                }}
            )
            db.resumes.delete_one({"_id": obj_id(resume_id)})
            
            resume_id = str(existing_resume["_id"])
            resume_doc = existing_resume
        else:
            db.resumes.update_one(
                {"_id": obj_id(resume_id)},
                {"$set": {
                    "candidate_name": ai_name,
                    "experience_years": ai_result.get("experience_years", 0.0),
                    "education_summary": ai_result.get("education_summary", ""),
                }}
            )
    else:
        db.resumes.update_one(
            {"_id": obj_id(resume_id)},
            {"$set": {
                "experience_years": ai_result.get("experience_years", 0.0),
                "education_summary": ai_result.get("education_summary", ""),
            }}
        )

    score_doc = {
        "resume_id": resume_id,
        "jd_id": jd_id,
        "score": ai_result.get("overall_score", 5.0),
        "skills_score": ai_result.get("skills_score", 5.0),
        "experience_score": ai_result.get("experience_score", 5.0),
        "education_score": ai_result.get("education_score", 5.0),
        "justification": ai_result.get("justification", ""),
        "matched_skills": ai_result.get("matched_skills", []),
        "missing_required_skills": ai_result.get("missing_required_skills", []),
        "missing_nice_to_have_skills": ai_result.get("missing_nice_to_have_skills", []),
        "top_skills": ai_result.get("top_skills", []),
        "feedback": ai_result.get("feedback", ""),
        "interview_questions": ai_result.get("interview_questions", []),
        "candidate_name": ai_name or resume_doc.get("candidate_name", ""),
        "candidate_email": resume_doc.get("candidate_email", ""),
        "experience_years": ai_result.get("experience_years", 0.0),
        "education_summary": ai_result.get("education_summary", ""),
        "used_fallback": ai_result.get("used_fallback", False),
        "scored_at": datetime.now(timezone.utc),
        "device_id": device_id,
    }

    db.scores.replace_one(
        {"resume_id": resume_id, "jd_id": jd_id},
        score_doc,
        upsert=True
    )

    audit_log(db, "RESUME_ANALYZED", {
        "resume_id": resume_id,
        "jd_id": jd_id,
        "score": ai_result.get("overall_score"),
        "used_fallback": ai_result.get("used_fallback", False)
    })

    return {
        "resume_id": resume_id,
        "jd_id": jd_id,
        "overall_score": ai_result.get("overall_score", 5.0),
        "skills_score": ai_result.get("skills_score", 5.0),
        "experience_score": ai_result.get("experience_score", 5.0),
        "education_score": ai_result.get("education_score", 5.0),
        "justification": ai_result.get("justification", ""),
        "matched_skills": ai_result.get("matched_skills", []),
        "missing_required_skills": ai_result.get("missing_required_skills", []),
        "missing_nice_to_have_skills": ai_result.get("missing_nice_to_have_skills", []),
        "candidate_name": ai_result.get("candidate_name", ""),
        "experience_years": ai_result.get("experience_years", 0.0),
        "top_skills": ai_result.get("top_skills", []),
        "education_summary": ai_result.get("education_summary", ""),
        "feedback": ai_result.get("feedback", ""),
        "interview_questions": ai_result.get("interview_questions", []),
        "used_fallback": ai_result.get("used_fallback", False),
    }

@app.get("/api/analysis/{jd_id}", tags=["analysis"])
async def get_analysis(
    jd_id: str,
    limit: int = Query(50),
    x_device_id: Optional[str] = Header(None)
):
    db = get_db()
    query = {"jd_id": jd_id}
    if x_device_id:
        query["device_id"] = x_device_id
    docs = list(db.scores.find(query).sort("score", DESCENDING).limit(limit))
    return {"shortlist": [serialize(d) for d in docs], "total": len(docs)}

@app.get("/api/scores/{resume_id}/{jd_id}", tags=["analysis"])
async def get_score(resume_id: str, jd_id: str):
    db = get_db()
    doc = db.scores.find_one({"resume_id": resume_id, "jd_id": jd_id})
    if not doc:
        raise HTTPException(404, "No analysis found. Please run analysis first.")
    return serialize(doc)

@app.get("/api/analytics/skills", tags=["analytics"])
async def analytics_skills():
    db = get_db()
    return get_skill_analytics(db)

@app.get("/api/analytics/score-distribution/{jd_id}", tags=["analytics"])
async def score_distribution(jd_id: str):
    db = get_db()
    docs = list(db.scores.find({"jd_id": jd_id}, {"score": 1}))
    buckets = {
        "1-2": 0, "2-3": 0, "3-4": 0, "4-5": 0,
        "5-6": 0, "6-7": 0, "7-8": 0, "8-9": 0, "9-10": 0
    }
    for doc in docs:
        s = doc.get("score", 0)
        for i in range(1, 10):
            if i <= s < i + 1:
                key = f"{i}-{i+1}"
                if key in buckets:
                    buckets[key] += 1
                break
        else:
            if s >= 9:
                buckets["9-10"] += 1
    return {"buckets": [{"range": k, "count": v} for k, v in buckets.items()]}

@app.post("/api/match/bulk", tags=["matching"])
async def score_bulk(
    background_tasks: BackgroundTasks,
    jd_id: str = Form(...),
    resume_ids: str = Form(""),
):
    db = get_db()
    ids = [r.strip() for r in resume_ids.split(",") if r.strip()]
    if not ids:
        all_docs = list(db.resumes.find({}, {"_id": 1}))
        ids = [str(d["_id"]) for d in all_docs]

    for resume_id in ids:
        background_tasks.add_task(_background_analyze, resume_id, jd_id)

    audit_log(db, "BULK_ANALYZE_STARTED", {"jd_id": jd_id, "resume_count": len(ids)})
    return {
        "message": f"Analyzing {len(ids)} resume(s) in background",
        "jd_id": jd_id,
        "resume_ids": ids
    }

async def _background_analyze(resume_id: str, jd_id: str):
    db = get_db()
    try:
        resume_doc = db.resumes.find_one({"_id": obj_id(resume_id)})
        jd_doc = db.job_descriptions.find_one({"_id": obj_id(jd_id)})
        if not resume_doc or not jd_doc:
            return

        resume_text = resume_doc.get("raw_text", "")
        jd_text = jd_doc.get("raw_text", "")
        if not resume_text or not jd_text:
            return

        ai_result = await ai_analyze_resume(resume_text, jd_text)

        score_doc = {
            "resume_id": resume_id,
            "jd_id": jd_id,
            "score": ai_result.get("overall_score", 5.0),
            "skills_score": ai_result.get("skills_score", 5.0),
            "experience_score": ai_result.get("experience_score", 5.0),
            "education_score": ai_result.get("education_score", 5.0),
            "justification": ai_result.get("justification", ""),
            "matched_skills": ai_result.get("matched_skills", []),
            "missing_required_skills": ai_result.get("missing_required_skills", []),
            "missing_nice_to_have_skills": ai_result.get("missing_nice_to_have_skills", []),
            "top_skills": ai_result.get("top_skills", []),
            "feedback": ai_result.get("feedback", ""),
            "interview_questions": ai_result.get("interview_questions", []),
            "candidate_name": ai_result.get("candidate_name", ""),
            "experience_years": ai_result.get("experience_years", 0.0),
            "education_summary": ai_result.get("education_summary", ""),
            "used_fallback": ai_result.get("used_fallback", False),
            "scored_at": datetime.now(timezone.utc),
            "device_id": resume_doc.get("device_id"),
        }

        db.scores.replace_one(
            {"resume_id": resume_id, "jd_id": jd_id},
            score_doc,
            upsert=True
        )

        update_fields = {"latest_score": ai_result.get("overall_score", 5.0)}
        if ai_result.get("candidate_name"):
            update_fields["candidate_name"] = ai_result["candidate_name"]
        if ai_result.get("top_skills"):
            update_fields["top_skills"] = ai_result["top_skills"]

        db.resumes.update_one(
            {"_id": obj_id(resume_id)},
            {"$set": update_fields}
        )

        audit_log(db, "RESUME_ANALYZED_BG", {
            "resume_id": resume_id,
            "jd_id": jd_id,
            "score": ai_result.get("overall_score"),
        })
    except Exception as e:
        log.error(f"Background analyze failed for resume {resume_id}: {e}")

@app.on_event("startup")
async def startup_event():
    log.info("TalentScan API v2 starting up...")
    get_db()
    log.info("TalentScan API ready.")

@app.on_event("shutdown")
async def shutdown_event():
    log.info("TalentScan API shutting down...")
    if _mongo_client:
        _mongo_client.close()
    log.info("Resources released.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=True)
