"""
AI Orchestrator Agent - The brain of the workflow choreographer.

This agent uses IBM watsonx to make intelligent decisions about 
incident handling, workflow orchestration, and tool coordination.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import json
import structlog

from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import Model
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames

from ..config import get_config
from ..models import (
    Incident, IncidentSeverity, IncidentCategory, 
    AIDecision, WorkflowStep, Workflow
)

logger = structlog.get_logger()


class AIOrchestrator:
    """
    AI-powered orchestrator that makes intelligent decisions
    about incident handling and workflow coordination.
    
    Uses IBM watsonx foundation models for:
    - Incident classification and severity assessment
    - Root cause hypothesis generation
    - Workflow step recommendation
    - Team assignment optimization
    """
    
    # Model configuration
    DEFAULT_MODEL = "ibm/granite-13b-chat-v2"
    ANALYSIS_MODEL = "ibm/granite-13b-instruct-v2"
    
    def __init__(self):
        self.config = get_config().watsonx
        self._client: Optional[APIClient] = None
        self._model: Optional[Model] = None
        self._analysis_model: Optional[Model] = None
    
    def _get_client(self) -> APIClient:
        """Initialize watsonx client."""
        if self._client is None:
            credentials = Credentials(
                url=self.config.url,
                api_key=self.config.api_key
            )
            self._client = APIClient(credentials)
        return self._client
    
    def _get_model(self, model_id: str = None) -> Model:
        """Get or create the foundation model."""
        model_id = model_id or self.DEFAULT_MODEL
        
        params = {
            GenTextParamsMetaNames.MAX_NEW_TOKENS: 1024,
            GenTextParamsMetaNames.MIN_NEW_TOKENS: 1,
            GenTextParamsMetaNames.TEMPERATURE: 0.3,
            GenTextParamsMetaNames.TOP_P: 0.9,
            GenTextParamsMetaNames.TOP_K: 50,
            GenTextParamsMetaNames.REPETITION_PENALTY: 1.1
        }
        
        return Model(
            model_id=model_id,
            params=params,
            credentials=Credentials(
                url=self.config.url,
                api_key=self.config.api_key
            ),
            project_id=self.config.project_id
        )
    
    async def classify_incident(
        self,
        title: str,
        description: str,
        source_data: Optional[Dict[str, Any]] = None
    ) -> AIDecision:
        """
        Classify an incident and determine severity and category.
        
        Args:
            title: Incident title
            description: Incident description
            source_data: Additional context from monitoring tools
            
        Returns:
            AIDecision with classification results
        """
        prompt = f"""You are an expert incident response analyst. Analyze the following incident and provide classification.

INCIDENT TITLE: {title}

INCIDENT DESCRIPTION: {description}

ADDITIONAL CONTEXT:
{json.dumps(source_data, indent=2) if source_data else "None provided"}

Based on your analysis, provide the following in JSON format:
{{
    "severity": "critical|high|medium|low",
    "category": "infrastructure|application|database|network|security|performance|integration|unknown",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation of your classification",
    "affected_systems": ["list", "of", "likely", "affected", "systems"],
    "recommended_priority": "P1|P2|P3|P4"
}}

Respond ONLY with the JSON object, no other text."""

        try:
            model = self._get_model()
            response = model.generate_text(prompt)
            
            # Parse the JSON response
            result = json.loads(response.strip())
            
            return AIDecision(
                incident_id="",  # Will be set later
                decision_type="incident_classification",
                reasoning=result.get("reasoning", ""),
                confidence=result.get("confidence", 0.5),
                recommended_actions=[],
                context_used={
                    "severity": result.get("severity"),
                    "category": result.get("category"),
                    "affected_systems": result.get("affected_systems", []),
                    "priority": result.get("recommended_priority")
                }
            )
            
        except Exception as e:
            logger.error("Failed to classify incident", error=str(e))
            # Return default classification
            return AIDecision(
                incident_id="",
                decision_type="incident_classification",
                reasoning=f"AI classification failed: {str(e)}. Using default values.",
                confidence=0.1,
                context_used={
                    "severity": "medium",
                    "category": "unknown"
                }
            )
    
    async def generate_root_cause_hypothesis(
        self,
        incident: Incident,
        logs: Optional[str] = None,
        recent_changes: Optional[List[Dict[str, Any]]] = None,
        metrics: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a root cause hypothesis based on available data.
        
        Args:
            incident: The incident to analyze
            logs: Relevant log entries
            recent_changes: Recent code/config changes
            metrics: Relevant metrics data
            
        Returns:
            Root cause hypothesis as a string
        """
        changes_text = ""
        if recent_changes:
            changes_text = "RECENT CHANGES:\n" + "\n".join([
                f"- {c.get('sha', 'N/A')[:8]}: {c.get('message', 'N/A')[:100]} by {c.get('author', 'Unknown')}"
                for c in recent_changes[:10]
            ])
        
        prompt = f"""You are an expert Site Reliability Engineer performing root cause analysis.

INCIDENT DETAILS:
- Title: {incident.title}
- Description: {incident.description}
- Severity: {incident.severity.value}
- Category: {incident.category.value}
- Affected Services: {', '.join(incident.affected_services) or 'Unknown'}

{changes_text}

LOGS:
{logs[:3000] if logs else "No logs available"}

METRICS:
{json.dumps(metrics, indent=2)[:1000] if metrics else "No metrics available"}

Based on this information, provide:
1. A concise root cause hypothesis (2-3 sentences)
2. Confidence level (low/medium/high)
3. Recommended investigation steps

Format your response as:
HYPOTHESIS: [Your hypothesis]
CONFIDENCE: [low/medium/high]
NEXT STEPS:
- [Step 1]
- [Step 2]
- [Step 3]"""

        try:
            model = self._get_model(self.ANALYSIS_MODEL)
            response = model.generate_text(prompt)
            return response.strip()
            
        except Exception as e:
            logger.error("Failed to generate hypothesis", error=str(e))
            return f"Unable to generate AI hypothesis. Error: {str(e)}"
    
    async def recommend_workflow_steps(
        self,
        incident: Incident,
        available_tools: List[str]
    ) -> List[WorkflowStep]:
        """
        Recommend workflow steps for handling an incident.
        
        Args:
            incident: The incident to handle
            available_tools: List of available tool integrations
            
        Returns:
            Ordered list of recommended workflow steps
        """
        tools_str = ", ".join(available_tools)
        
        prompt = f"""You are an expert incident response coordinator. Given an incident, recommend the optimal sequence of actions.

INCIDENT:
- Title: {incident.title}
- Severity: {incident.severity.value}
- Category: {incident.category.value}
- Description: {incident.description}

AVAILABLE TOOLS: {tools_str}

Recommend a sequence of workflow steps in JSON format. Each step should have:
- name: Human-readable step name
- action: Action identifier
- target_tool: Which tool to use
- parameters: Any required parameters (use placeholders like {{incident_id}})
- priority: 1 (highest) to 5 (lowest)

Example actions: create_ticket, create_channel, notify_team, gather_logs, analyze_commits, create_postmortem

Respond with a JSON array of steps ordered by execution priority:
[
    {{"name": "...", "action": "...", "target_tool": "...", "parameters": {{}}, "priority": 1}},
    ...
]

Consider the severity when recommending steps. Critical incidents need immediate response team assembly."""

        try:
            model = self._get_model()
            response = model.generate_text(prompt)
            
            # Parse JSON response
            steps_data = json.loads(response.strip())
            
            workflow_steps = []
            for step_data in steps_data:
                step = WorkflowStep(
                    name=step_data.get("name", "Unknown Step"),
                    action=step_data.get("action", "unknown"),
                    target_tool=step_data.get("target_tool", "unknown"),
                    parameters=step_data.get("parameters", {})
                )
                workflow_steps.append(step)
            
            return workflow_steps
            
        except Exception as e:
            logger.error("Failed to recommend workflow steps", error=str(e))
            # Return default workflow
            return self._get_default_workflow_steps(incident)
    
    async def recommend_team_assignment(
        self,
        incident: Incident,
        available_teams: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Recommend team assignment based on incident characteristics.
        
        Args:
            incident: The incident
            available_teams: List of available teams with their skills
            
        Returns:
            Recommended team assignment
        """
        teams_info = json.dumps(available_teams, indent=2)
        
        prompt = f"""You are assigning an incident to the most appropriate team.

INCIDENT:
- Title: {incident.title}
- Category: {incident.category.value}
- Severity: {incident.severity.value}
- Affected Services: {', '.join(incident.affected_services)}

AVAILABLE TEAMS:
{teams_info}

Select the best team and provide reasoning in JSON format:
{{
    "primary_team": "team_name",
    "secondary_team": "team_name_or_null",
    "reasoning": "Brief explanation",
    "required_skills": ["skill1", "skill2"],
    "escalation_path": ["team1", "team2"]
}}"""

        try:
            model = self._get_model()
            response = model.generate_text(prompt)
            return json.loads(response.strip())
            
        except Exception as e:
            logger.error("Failed to recommend team", error=str(e))
            return {
                "primary_team": "on-call",
                "reasoning": "Default assignment due to AI error",
                "required_skills": []
            }
    
    async def summarize_incident_for_communication(
        self,
        incident: Incident,
        audience: str = "technical"
    ) -> str:
        """
        Generate an audience-appropriate summary of the incident.
        
        Args:
            incident: The incident to summarize
            audience: Target audience (technical, executive, customer)
        """
        prompt = f"""Summarize this incident for a {audience} audience.

INCIDENT:
- Title: {incident.title}
- Severity: {incident.severity.value}
- Status: {incident.status.value}
- Description: {incident.description}
- Root Cause: {incident.root_cause_hypothesis or 'Under investigation'}

Write a clear, {audience}-appropriate summary in 2-3 sentences.
{"Include technical details." if audience == "technical" else "Focus on business impact and timeline."}"""

        try:
            model = self._get_model()
            response = model.generate_text(prompt)
            return response.strip()
            
        except Exception as e:
            logger.error("Failed to summarize incident", error=str(e))
            return incident.description
    
    def _get_default_workflow_steps(self, incident: Incident) -> List[WorkflowStep]:
        """Get default workflow steps when AI recommendation fails."""
        steps = [
            WorkflowStep(
                name="Create ServiceNow Ticket",
                action="create_ticket",
                target_tool="servicenow",
                parameters={"incident_id": incident.id}
            ),
            WorkflowStep(
                name="Create Incident Channel",
                action="create_channel",
                target_tool="slack",
                parameters={"incident_id": incident.id}
            ),
        ]
        
        if incident.severity in [IncidentSeverity.CRITICAL, IncidentSeverity.HIGH]:
            steps.append(WorkflowStep(
                name="Notify Response Team",
                action="notify_team",
                target_tool="slack",
                parameters={"urgency": "high"}
            ))
            steps.append(WorkflowStep(
                name="Analyze Recent Changes",
                action="analyze_commits",
                target_tool="github",
                parameters={"hours_back": 24}
            ))
        
        steps.append(WorkflowStep(
            name="Create Post-Mortem Template",
            action="create_postmortem",
            target_tool="confluence",
            parameters={"incident_id": incident.id}
        ))
        
        return steps


# Singleton instance
_orchestrator: Optional[AIOrchestrator] = None


def get_ai_orchestrator() -> AIOrchestrator:
    """Get the AI orchestrator singleton."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AIOrchestrator()
    return _orchestrator
