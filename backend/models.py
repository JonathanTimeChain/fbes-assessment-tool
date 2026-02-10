"""
FBES Self-Assessment Tool — Database Models
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    organization = Column(String(255))
    name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    
    assessments = relationship("Assessment", back_populates="user")


class Assessment(Base):
    __tablename__ = "assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Program info
    program_name = Column(String(255), nullable=False)
    organization = Column(String(255))
    program_level = Column(String(50))  # introductory, intermediate, advanced, professional
    target_audience = Column(JSON)  # list of audience types
    delivery_format = Column(JSON)  # list of formats
    program_duration = Column(String(50))
    assessor_role = Column(String(100))
    
    # Status
    status = Column(String(50), default="in_progress")  # in_progress, completed
    current_category = Column(Integer, default=1)
    
    # Responses stored as JSON
    responses = Column(JSON, default=dict)
    
    # Results (populated when completed)
    overall_score = Column(Float)
    category_scores = Column(JSON)
    recommendations = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    
    user = relationship("User", back_populates="assessments")


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False)  # page_view, assessment_started, assessment_completed, etc.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True)
    event_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
