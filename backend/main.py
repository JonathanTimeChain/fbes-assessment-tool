"""
FBES Self-Assessment Tool — FastAPI Backend
"""
import json
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, Response, Cookie, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from jose import JWTError, jwt
import hashlib

from models import Base, User, Assessment, AnalyticsEvent

# Configuration
DATABASE_URL = "sqlite:///./fbes_assessment.db"
SECRET_KEY = "fbes-assessment-tool-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Database setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# Password hashing (using sha256 for compatibility; upgrade to bcrypt in production)
class SimplePwdContext:
    def hash(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()
    
    def verify(self, password: str, hashed: str) -> bool:
        return hashlib.sha256(password.encode()).hexdigest() == hashed

pwd_context = SimplePwdContext()

# Load categories data
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
with open(os.path.join(DATA_DIR, "categories.json")) as f:
    CATEGORIES_DATA = json.load(f)

app = FastAPI(title="FBES Self-Assessment Tool", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    organization: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ProgramInfo(BaseModel):
    program_name: str
    organization: Optional[str] = None
    program_level: str
    target_audience: List[str] = []
    delivery_format: List[str] = []
    program_duration: Optional[str] = None
    assessor_role: Optional[str] = None

class ResponseUpdate(BaseModel):
    question_id: str
    answer: str  # "yes", "partial", "no"
    notes: Optional[str] = None

class AssessmentResponse(BaseModel):
    id: int
    program_name: str
    status: str
    overall_score: Optional[float]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

# --- Dependencies ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Cookie(None, alias="access_token"), 
    db: Session = Depends(get_db)
):
    # Try Bearer token first, then cookie
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization[7:]
    elif token:
        auth_token = token
    
    if not auth_token:
        return None
    try:
        payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            return None
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except JWTError:
        return None

def require_auth(user: Optional[User] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user

# --- Auth Endpoints ---

@app.post("/api/auth/register")
def register(response: Response, user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = pwd_context.hash(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed,
        name=user_data.name,
        organization=user_data.organization
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Log analytics
    event = AnalyticsEvent(event_type="user_registered", user_id=user.id)
    db.add(event)
    db.commit()
    
    token = create_access_token({"sub": user.id})
    response.set_cookie(key="access_token", value=token, httponly=True, max_age=60*60*24*30, path="/", samesite="lax")
    return {"message": "Registration successful", "token": token, "user": {"email": user.email, "name": user.name}}

@app.post("/api/auth/login")
def login(response: Response, user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not pwd_context.verify(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Log analytics
    event = AnalyticsEvent(event_type="user_login", user_id=user.id)
    db.add(event)
    db.commit()
    
    token = create_access_token({"sub": user.id})
    response.set_cookie(key="access_token", value=token, httponly=True, max_age=60*60*24*30, path="/", samesite="lax")
    return {"message": "Login successful", "token": token, "user": {"email": user.email, "name": user.name}}

@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}

@app.get("/api/auth/me")
def get_me(user: User = Depends(require_auth)):
    return {"email": user.email, "name": user.name, "organization": user.organization}

# --- Categories Endpoint ---

@app.get("/api/categories")
def get_categories():
    return CATEGORIES_DATA

# --- Assessment Endpoints ---

@app.post("/api/assessments")
def create_assessment(program_info: ProgramInfo, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    assessment = Assessment(
        user_id=user.id,
        program_name=program_info.program_name,
        organization=program_info.organization,
        program_level=program_info.program_level,
        target_audience=program_info.target_audience,
        delivery_format=program_info.delivery_format,
        program_duration=program_info.program_duration,
        assessor_role=program_info.assessor_role,
        responses={}
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    
    # Log analytics
    event = AnalyticsEvent(event_type="assessment_started", user_id=user.id, assessment_id=assessment.id)
    db.add(event)
    db.commit()
    
    return {"id": assessment.id, "message": "Assessment created"}

@app.get("/api/assessments")
def list_assessments(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    assessments = db.query(Assessment).filter(Assessment.user_id == user.id).order_by(Assessment.updated_at.desc()).all()
    return [
        {
            "id": a.id,
            "program_name": a.program_name,
            "status": a.status,
            "overall_score": a.overall_score,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
            "completed_at": a.completed_at
        }
        for a in assessments
    ]

@app.get("/api/assessments/{assessment_id}")
def get_assessment(assessment_id: int, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id, Assessment.user_id == user.id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {
        "id": assessment.id,
        "program_name": assessment.program_name,
        "organization": assessment.organization,
        "program_level": assessment.program_level,
        "target_audience": assessment.target_audience,
        "delivery_format": assessment.delivery_format,
        "status": assessment.status,
        "current_category": assessment.current_category,
        "responses": assessment.responses,
        "overall_score": assessment.overall_score,
        "category_scores": assessment.category_scores,
        "recommendations": assessment.recommendations,
        "created_at": assessment.created_at,
        "updated_at": assessment.updated_at,
        "completed_at": assessment.completed_at
    }

@app.put("/api/assessments/{assessment_id}/responses")
def update_responses(assessment_id: int, responses: Dict[str, Dict[str, Any]], db: Session = Depends(get_db), user: User = Depends(require_auth)):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id, Assessment.user_id == user.id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Merge new responses with existing
    current = assessment.responses or {}
    current.update(responses)
    assessment.responses = current
    assessment.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Responses saved"}

@app.post("/api/assessments/{assessment_id}/complete")
def complete_assessment(assessment_id: int, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id, Assessment.user_id == user.id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Calculate scores
    responses = assessment.responses or {}
    scoring = CATEGORIES_DATA["scoring"]
    category_scores = {}
    total_weighted_score = 0
    total_weight = 0
    
    for category in CATEGORIES_DATA["categories"]:
        cat_id = str(category["id"])
        cat_weight = category["weight"]
        cat_responses = responses.get(cat_id, {})
        
        max_score = 0
        actual_score = 0
        
        for question in category["questions"]:
            q_id = question["id"]
            impact = question.get("impact", 1.0)
            max_score += 2 * impact  # "yes" = 2 points
            
            answer = cat_responses.get(q_id, {}).get("answer", "no")
            if answer == "yes":
                actual_score += 2 * impact
            elif answer == "partial":
                actual_score += 1 * impact
        
        raw_pct = (actual_score / max_score * 100) if max_score > 0 else 0
        weighted_score = raw_pct * cat_weight
        total_weighted_score += weighted_score
        total_weight += cat_weight
        
        status = "strong" if raw_pct >= 75 else ("adequate" if raw_pct >= 50 else "weak")
        category_scores[cat_id] = {
            "name": category["name"],
            "raw_score": round(raw_pct, 1),
            "weighted_score": round(weighted_score, 2),
            "status": status
        }
    
    overall_score = round(total_weighted_score / total_weight, 1) if total_weight > 0 else 0
    
    # Generate recommendations
    recommendations = []
    for category in CATEGORIES_DATA["categories"]:
        cat_id = str(category["id"])
        cat_responses = responses.get(cat_id, {})
        for question in category["questions"]:
            q_id = question["id"]
            answer = cat_responses.get(q_id, {}).get("answer", "no")
            if answer in ["no", "partial"]:
                recommendations.append({
                    "category": category["name"],
                    "question": question["text"],
                    "current_answer": answer,
                    "guidance": question.get("guidance", ""),
                    "impact": question.get("impact", 1.0),
                    "priority_score": category["weight"] * question.get("impact", 1.0) * (2 if answer == "no" else 1)
                })
    
    recommendations.sort(key=lambda x: x["priority_score"], reverse=True)
    top_recommendations = recommendations[:10]
    
    # Update assessment
    assessment.status = "completed"
    assessment.overall_score = overall_score
    assessment.category_scores = category_scores
    assessment.recommendations = top_recommendations
    assessment.completed_at = datetime.utcnow()
    db.commit()
    
    # Log analytics
    event = AnalyticsEvent(
        event_type="assessment_completed", 
        user_id=user.id, 
        assessment_id=assessment.id,
        event_data={"overall_score": overall_score}
    )
    db.add(event)
    db.commit()
    
    return {
        "overall_score": overall_score,
        "category_scores": category_scores,
        "recommendations": top_recommendations,
        "readiness": "ready" if overall_score >= 75 else ("promising" if overall_score >= 50 else "needs_work")
    }

# --- Analytics Endpoints (Admin) ---

@app.get("/api/analytics/summary")
def get_analytics_summary(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_assessments = db.query(Assessment).count()
    completed_assessments = db.query(Assessment).filter(Assessment.status == "completed").count()
    
    # Average score of completed assessments
    completed = db.query(Assessment).filter(Assessment.status == "completed").all()
    avg_score = sum(a.overall_score or 0 for a in completed) / len(completed) if completed else 0
    
    return {
        "total_users": total_users,
        "total_assessments": total_assessments,
        "completed_assessments": completed_assessments,
        "completion_rate": round(completed_assessments / total_assessments * 100, 1) if total_assessments > 0 else 0,
        "average_score": round(avg_score, 1)
    }

# --- Serve Frontend ---

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

@app.get("/", response_class=HTMLResponse)
def serve_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>FBES Self-Assessment Tool</h1><p>Frontend not found.</p>")

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8891))
    uvicorn.run(app, host="0.0.0.0", port=port)
