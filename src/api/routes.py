"""
REST API routes for the Enterprise Workflow Choreographer.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from ..models import Incident, IncidentSeverity, IncidentStatus, TeamMember
from ..agents import get_incident_agent
from ..workflows import get_choreographer, get_incident_workflow

router = APIRouter()


# ============ Request/Response Models ============

class AlertWebhookRequest(BaseModel):
    """Incoming alert from monitoring tools."""
    source: str = Field(..., description="Alert source (datadog, pagerduty, etc.)")
    alert_id: Optional[str] = None
    title: Optional[str] = None
    message: Optional[str] = None
    severity: Optional[str] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class ManualIncidentRequest(BaseModel):
    """Manual incident report."""
    title: str = Field(..., min_length=5)
    description: str = Field(..., min_length=10)
    reporter: str
    severity: Optional[str] = None
    affected_services: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class IncidentResponse(BaseModel):
    """Response with incident details."""
    id: str
    title: str
    description: str
    severity: str
    status: str
    category: str
    servicenow_ticket_id: Optional[str]
    slack_channel_id: Optional[str]
    confluence_page_id: Optional[str]
    detected_at: datetime
    root_cause_hypothesis: Optional[str]


class WorkflowResponse(BaseModel):
    """Response with workflow details."""
    id: str
    incident_id: str
    name: str
    status: str
    current_step: int
    total_steps: int
    completed_steps: int
    failed_steps: int
    created_at: datetime
    completed_at: Optional[datetime]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: datetime
    version: str


# ============ Routes ============

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        version="1.0.0"
    )


@router.post("/webhook/alert", response_model=IncidentResponse)
async def receive_alert(
    request: AlertWebhookRequest,
    background_tasks: BackgroundTasks
):
    """
    Receive an alert webhook from monitoring tools.
    
    This endpoint:
    1. Processes the alert
    2. Creates an incident
    3. Triggers automated response workflow
    """
    incident_agent = get_incident_agent()
    choreographer = get_choreographer()
    
    # Convert request to alert data dict
    alert_data = {
        "alert_id": request.alert_id,
        "title": request.title,
        "message": request.message,
        "severity": request.severity,
        "tags": request.tags or [],
        **(request.metadata or {})
    }
    
    # Process alert and create incident
    incident = await incident_agent.process_alert(
        alert_data=alert_data,
        source=request.source
    )
    
    # Trigger workflow in background
    background_tasks.add_task(
        choreographer.orchestrate_incident_response,
        incident=incident
    )
    
    return _incident_to_response(incident)


@router.post("/incident", response_model=IncidentResponse)
async def create_incident(
    request: ManualIncidentRequest,
    background_tasks: BackgroundTasks
):
    """
    Create a manually reported incident.
    
    This triggers the same automated workflow as alert-based incidents.
    """
    incident_agent = get_incident_agent()
    choreographer = get_choreographer()
    
    # Parse severity if provided
    severity = None
    if request.severity:
        try:
            severity = IncidentSeverity(request.severity.lower())
        except ValueError:
            pass
    
    # Create incident from manual report
    incident = await incident_agent.process_manual_report(
        title=request.title,
        description=request.description,
        reporter=request.reporter,
        affected_services=request.affected_services,
        initial_severity=severity
    )
    
    # Add tags if provided
    if request.tags:
        incident.tags.extend(request.tags)
    
    # Trigger workflow in background
    background_tasks.add_task(
        choreographer.orchestrate_incident_response,
        incident=incident
    )
    
    return _incident_to_response(incident)


@router.get("/incident/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: str):
    """Get incident details by ID."""
    choreographer = get_choreographer()
    
    # Look for incident in active workflows
    for workflow in choreographer.list_active_workflows():
        if workflow.incident_id == incident_id:
            # This is a simplified version - in production, you'd have
            # a proper incident store
            raise HTTPException(
                status_code=200,
                detail="Incident found in active workflow"
            )
    
    raise HTTPException(status_code=404, detail="Incident not found")


@router.get("/workflows", response_model=List[WorkflowResponse])
async def list_workflows():
    """List all active workflows."""
    choreographer = get_choreographer()
    workflows = choreographer.list_active_workflows()
    
    return [_workflow_to_response(w) for w in workflows]


@router.get("/workflow/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str):
    """Get workflow details by ID."""
    choreographer = get_choreographer()
    workflow = choreographer.get_workflow_status(workflow_id)
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return _workflow_to_response(workflow)


@router.post("/incident/{incident_id}/analyze")
async def trigger_analysis(
    incident_id: str,
    repos: Optional[List[str]] = None
):
    """Trigger additional analysis for an incident."""
    # This would trigger the analysis agent
    # For now, return a placeholder
    return {
        "status": "analysis_triggered",
        "incident_id": incident_id,
        "repos": repos or []
    }


# ============ IBM Watson Orchestrate Workflow Endpoint ============

class OrchestrateWorkflowRequest(BaseModel):
    """Request to trigger IBM Watson Orchestrate workflow."""
    title: str = Field(..., min_length=5)
    description: str = Field(..., min_length=10)
    source: str = Field(default="manual", description="Incident source")
    severity: Optional[str] = None
    affected_services: Optional[List[str]] = None
    repositories: Optional[List[str]] = None
    team_members: Optional[List[Dict[str, Any]]] = None


@router.post("/orchestrate/incident-workflow")
async def trigger_incident_workflow(
    request: OrchestrateWorkflowRequest,
    background_tasks: BackgroundTasks
):
    """
    Trigger the complete IBM Watson Orchestrate Incident Response Workflow.
    
    This executes the full 7-step workflow:
    1. Create ServiceNow Ticket
    2. Send Slack Alert
    3. Gather Diagnostic Information
    4. Analyze Root Cause
    5. Create Confluence Incident Page
    6. Assign and Notify (via Jira)
    7. Monitor and Update
    """
    incident_agent = get_incident_agent()
    workflow = get_incident_workflow()
    
    # Parse severity
    severity = IncidentSeverity.MEDIUM
    if request.severity:
        try:
            severity = IncidentSeverity(request.severity.lower())
        except ValueError:
            pass
    
    # Create incident
    incident = await incident_agent.process_manual_report(
        title=request.title,
        description=request.description,
        reporter="IBM Watson Orchestrate",
        affected_services=request.affected_services,
        initial_severity=severity
    )
    
    # Convert team members if provided
    team_members = None
    if request.team_members:
        team_members = [
            TeamMember(
                id=m.get("id", f"tm-{i}"),
                name=m.get("name", "Unknown"),
                email=m.get("email"),
                slack_id=m.get("slack_id"),
                skills=m.get("skills", []),
                on_call=m.get("on_call", False)
            )
            for i, m in enumerate(request.team_members)
        ]
    
    # Execute workflow in background
    background_tasks.add_task(
        workflow.execute_workflow,
        incident=incident,
        repositories=request.repositories,
        team_members=team_members
    )
    
    return {
        "status": "workflow_triggered",
        "incident_id": incident.id,
        "incident_title": incident.title,
        "severity": incident.severity.value,
        "message": "IBM Watson Orchestrate workflow started - processing 7 steps",
        "workflow_steps": [
            "1. Create ServiceNow Ticket",
            "2. Send Slack Alert",
            "3. Gather Diagnostic Information",
            "4. Analyze Root Cause",
            "5. Create Confluence Incident Page",
            "6. Assign and Notify (Jira)",
            "7. Monitor and Update"
        ]
    }


# ============ Helper Functions ============

def _incident_to_response(incident: Incident) -> IncidentResponse:
    """Convert Incident model to API response."""
    return IncidentResponse(
        id=incident.id,
        title=incident.title,
        description=incident.description,
        severity=incident.severity.value,
        status=incident.status.value,
        category=incident.category.value,
        servicenow_ticket_id=incident.servicenow_ticket_id,
        slack_channel_id=incident.slack_channel_id,
        confluence_page_id=incident.confluence_page_id,
        detected_at=incident.detected_at,
        root_cause_hypothesis=incident.root_cause_hypothesis
    )


def _workflow_to_response(workflow) -> WorkflowResponse:
    """Convert Workflow model to API response."""
    return WorkflowResponse(
        id=workflow.id,
        incident_id=workflow.incident_id,
        name=workflow.name,
        status=workflow.status,
        current_step=workflow.current_step_index,
        total_steps=len(workflow.steps),
        completed_steps=sum(1 for s in workflow.steps if s.status == "completed"),
        failed_steps=sum(1 for s in workflow.steps if s.status == "failed"),
        created_at=workflow.created_at,
        completed_at=workflow.completed_at
    )
