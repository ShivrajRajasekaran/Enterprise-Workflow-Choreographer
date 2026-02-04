"""
Data models for the Enterprise Workflow Choreographer.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid


class IncidentSeverity(str, Enum):
    """Incident severity levels."""
    CRITICAL = "critical"  # P1 - Immediate response required
    HIGH = "high"          # P2 - Response within 1 hour
    MEDIUM = "medium"      # P3 - Response within 4 hours
    LOW = "low"            # P4 - Response within 24 hours


class IncidentStatus(str, Enum):
    """Incident status."""
    DETECTED = "detected"
    TRIAGING = "triaging"
    IN_PROGRESS = "in_progress"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IncidentCategory(str, Enum):
    """Incident categories."""
    INFRASTRUCTURE = "infrastructure"
    APPLICATION = "application"
    DATABASE = "database"
    NETWORK = "network"
    SECURITY = "security"
    PERFORMANCE = "performance"
    INTEGRATION = "integration"
    UNKNOWN = "unknown"


class Incident(BaseModel):
    """Represents an incident in the system."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    severity: IncidentSeverity
    status: IncidentStatus = IncidentStatus.DETECTED
    category: IncidentCategory = IncidentCategory.UNKNOWN
    
    # Source information
    source_system: str = ""  # e.g., "datadog", "pagerduty", "manual"
    source_alert_id: Optional[str] = None
    
    # Affected systems
    affected_services: List[str] = Field(default_factory=list)
    affected_components: List[str] = Field(default_factory=list)
    
    # External references
    servicenow_ticket_id: Optional[str] = None
    github_issue_url: Optional[str] = None
    slack_channel_id: Optional[str] = None
    confluence_page_id: Optional[str] = None
    
    # Team information
    assigned_team: Optional[str] = None
    assigned_responders: List[str] = Field(default_factory=list)
    
    # Analysis
    root_cause_hypothesis: Optional[str] = None
    resolution_steps: List[str] = Field(default_factory=list)
    
    # Timestamps
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = None
    mitigated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    
    # Metadata
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkflowStep(BaseModel):
    """Represents a single step in a workflow."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    action: str  # e.g., "create_ticket", "notify_team", "gather_logs"
    target_tool: str  # e.g., "servicenow", "slack", "github"
    parameters: Dict[str, Any] = Field(default_factory=dict)
    
    status: str = "pending"  # pending, running, completed, failed, skipped
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class Workflow(BaseModel):
    """Represents a workflow being executed."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    incident_id: str
    name: str
    description: str
    
    steps: List[WorkflowStep] = Field(default_factory=list)
    current_step_index: int = 0
    
    status: str = "pending"  # pending, running, completed, failed, cancelled
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TeamMember(BaseModel):
    """Represents a team member who can be assigned to incidents."""
    id: str
    name: str
    email: str
    slack_user_id: Optional[str] = None
    github_username: Optional[str] = None
    
    teams: List[str] = Field(default_factory=list)  # e.g., ["platform", "dba", "security"]
    skills: List[str] = Field(default_factory=list)  # e.g., ["kubernetes", "postgresql", "java"]
    on_call: bool = False


class ActionResult(BaseModel):
    """Result of an action performed by the orchestrator."""
    success: bool
    action: str
    tool: str
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AIDecision(BaseModel):
    """Represents a decision made by the AI orchestrator."""
    decision_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    incident_id: str
    
    decision_type: str  # e.g., "severity_classification", "team_assignment", "next_action"
    reasoning: str
    confidence: float  # 0.0 to 1.0
    
    recommended_actions: List[str] = Field(default_factory=list)
    selected_action: Optional[str] = None
    
    context_used: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
