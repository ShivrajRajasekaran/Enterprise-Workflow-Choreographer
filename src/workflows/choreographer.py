"""
Dynamic Workflow Choreographer.

This is the core engine that coordinates multi-tool workflows
without human intervention, dynamically adapting based on
incident context and AI recommendations.
"""

from typing import Optional, Dict, Any, List, Callable, Awaitable
from datetime import datetime
from enum import Enum
import asyncio
import structlog

from ..models import (
    Incident, IncidentStatus, Workflow, WorkflowStep, 
    ActionResult, TeamMember
)
from ..config import get_config
from ..connectors import (
    get_servicenow_connector,
    get_slack_connector,
    get_github_connector,
    get_confluence_connector
)
from ..agents import get_ai_orchestrator, get_analysis_agent

logger = structlog.get_logger()


class WorkflowStatus(str, Enum):
    """Workflow execution status."""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkflowChoreographer:
    """
    Dynamic workflow choreographer that coordinates actions across
    multiple enterprise tools based on AI-driven decisions.
    
    Key Features:
    - Dynamic workflow generation based on incident context
    - Parallel and sequential step execution
    - Automatic retry and error handling
    - Real-time adaptation based on step results
    - No pre-defined rigid workflows
    """
    
    def __init__(self):
        self.config = get_config()
        self.ai = get_ai_orchestrator()
        self.analysis = get_analysis_agent()
        
        # Connectors
        self.servicenow = get_servicenow_connector()
        self.slack = get_slack_connector()
        self.github = get_github_connector()
        self.confluence = get_confluence_connector()
        
        # Active workflows
        self.active_workflows: Dict[str, Workflow] = {}
        
        # Action handlers mapping
        self._action_handlers: Dict[str, Callable] = {
            "create_ticket": self._handle_create_ticket,
            "update_ticket": self._handle_update_ticket,
            "create_channel": self._handle_create_channel,
            "notify_team": self._handle_notify_team,
            "assemble_team": self._handle_assemble_team,
            "analyze_commits": self._handle_analyze_commits,
            "gather_logs": self._handle_gather_logs,
            "create_postmortem": self._handle_create_postmortem,
            "generate_hypothesis": self._handle_generate_hypothesis,
            "search_knowledge": self._handle_search_knowledge,
            "post_update": self._handle_post_update,
        }
    
    async def orchestrate_incident_response(
        self,
        incident: Incident,
        team_members: Optional[List[TeamMember]] = None
    ) -> Workflow:
        """
        Orchestrate the complete incident response workflow.
        
        This is the main entry point that:
        1. Gets AI recommendations for workflow steps
        2. Creates and executes the workflow
        3. Adapts based on results
        
        Args:
            incident: The incident to respond to
            team_members: Available team members for assignment
            
        Returns:
            Completed workflow with all results
        """
        logger.info(
            "Starting incident response orchestration",
            incident_id=incident.id,
            severity=incident.severity.value
        )
        
        # Get available tools
        available_tools = self._get_available_tools()
        
        # Get AI-recommended workflow steps
        recommended_steps = await self.ai.recommend_workflow_steps(
            incident=incident,
            available_tools=available_tools
        )
        
        # Create workflow
        workflow = Workflow(
            incident_id=incident.id,
            name=f"Incident Response: {incident.title[:50]}",
            description=f"Automated response workflow for {incident.severity.value} incident",
            steps=recommended_steps
        )
        
        # Store active workflow
        self.active_workflows[workflow.id] = workflow
        
        # Execute workflow
        await self._execute_workflow(workflow, incident, team_members)
        
        return workflow
    
    async def _execute_workflow(
        self,
        workflow: Workflow,
        incident: Incident,
        team_members: Optional[List[TeamMember]] = None
    ) -> None:
        """Execute a workflow's steps."""
        workflow.status = WorkflowStatus.RUNNING.value
        workflow.started_at = datetime.utcnow()
        
        logger.info(
            "Executing workflow",
            workflow_id=workflow.id,
            total_steps=len(workflow.steps)
        )
        
        context = {
            "incident": incident,
            "team_members": team_members or [],
            "results": {}
        }
        
        for i, step in enumerate(workflow.steps):
            workflow.current_step_index = i
            
            logger.info(
                "Executing workflow step",
                step_name=step.name,
                step_index=i,
                action=step.action
            )
            
            try:
                result = await self._execute_step(step, context)
                
                step.status = "completed" if result.success else "failed"
                step.result = result.data
                step.completed_at = datetime.utcnow()
                
                # Store result for subsequent steps
                context["results"][step.action] = result
                
                # Update incident with results
                self._update_incident_from_result(incident, step, result)
                
                if not result.success and self._is_critical_step(step):
                    logger.warning(
                        "Critical step failed",
                        step_name=step.name,
                        error=result.error
                    )
                    # Don't fail entire workflow, continue with remaining steps
                
            except Exception as e:
                logger.error(
                    "Step execution error",
                    step_name=step.name,
                    error=str(e)
                )
                step.status = "failed"
                step.error = str(e)
                step.completed_at = datetime.utcnow()
        
        workflow.status = WorkflowStatus.COMPLETED.value
        workflow.completed_at = datetime.utcnow()
        
        logger.info(
            "Workflow completed",
            workflow_id=workflow.id,
            successful_steps=sum(1 for s in workflow.steps if s.status == "completed"),
            failed_steps=sum(1 for s in workflow.steps if s.status == "failed")
        )
    
    async def _execute_step(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Execute a single workflow step."""
        step.status = "running"
        step.started_at = datetime.utcnow()
        
        handler = self._action_handlers.get(step.action)
        
        if not handler:
            return ActionResult(
                success=False,
                action=step.action,
                tool=step.target_tool,
                message=f"Unknown action: {step.action}",
                error="No handler registered for action"
            )
        
        try:
            result = await handler(step, context)
            return result
        except Exception as e:
            return ActionResult(
                success=False,
                action=step.action,
                tool=step.target_tool,
                message=f"Action failed: {str(e)}",
                error=str(e)
            )
    
    # ============ Action Handlers ============
    
    async def _handle_create_ticket(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Create ServiceNow ticket."""
        incident: Incident = context["incident"]
        
        if not self.config.features.auto_ticketing:
            return ActionResult(
                success=True,
                action=step.action,
                tool="servicenow",
                message="Auto-ticketing disabled",
                data={"skipped": True}
            )
        
        result = await self.servicenow.create_incident(incident)
        
        if result.get("success"):
            incident.servicenow_ticket_id = result.get("number")
            return ActionResult(
                success=True,
                action=step.action,
                tool="servicenow",
                message=f"Created ticket {result.get('number')}",
                data=result
            )
        
        return ActionResult(
            success=False,
            action=step.action,
            tool="servicenow",
            message="Failed to create ticket",
            error=result.get("error")
        )
    
    async def _handle_update_ticket(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Update ServiceNow ticket."""
        incident: Incident = context["incident"]
        
        if not incident.servicenow_ticket_id:
            return ActionResult(
                success=False,
                action=step.action,
                tool="servicenow",
                message="No ticket ID available",
                error="servicenow_ticket_id not set"
            )
        
        # Get sys_id from previous create result or fetch it
        updates = step.parameters.get("updates", {})
        
        # For now, add a work note
        result = await self.servicenow.add_work_note(
            sys_id=incident.servicenow_ticket_id,
            note=updates.get("note", "Automated update from Workflow Choreographer")
        )
        
        return ActionResult(
            success=result.get("success", False),
            action=step.action,
            tool="servicenow",
            message="Ticket updated" if result.get("success") else "Update failed",
            data=result
        )
    
    async def _handle_create_channel(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Create Slack incident channel."""
        incident: Incident = context["incident"]
        
        if not self.config.features.slack_notifications:
            return ActionResult(
                success=True,
                action=step.action,
                tool="slack",
                message="Slack notifications disabled",
                data={"skipped": True}
            )
        
        result = await self.slack.create_incident_channel(incident)
        
        if result.get("success"):
            incident.slack_channel_id = result.get("channel_id")
            return ActionResult(
                success=True,
                action=step.action,
                tool="slack",
                message=f"Created channel {result.get('channel_name')}",
                data=result
            )
        
        return ActionResult(
            success=False,
            action=step.action,
            tool="slack",
            message="Failed to create channel",
            error=result.get("error")
        )
    
    async def _handle_notify_team(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Send team notification."""
        incident: Incident = context["incident"]
        
        channel = incident.slack_channel_id or step.parameters.get("channel")
        if not channel:
            return ActionResult(
                success=False,
                action=step.action,
                tool="slack",
                message="No channel available for notification",
                error="No channel_id"
            )
        
        message = step.parameters.get(
            "message",
            f"🚨 *{incident.severity.value.upper()} Incident Detected*\n\n"
            f"{incident.title}\n\n"
            f"Team members have been notified. Please acknowledge."
        )
        
        result = await self.slack.notify_team(
            channel=channel,
            message=message,
            incident=incident
        )
        
        return ActionResult(
            success=result.get("success", False),
            action=step.action,
            tool="slack",
            message="Team notified" if result.get("success") else "Notification failed",
            data=result
        )
    
    async def _handle_assemble_team(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Assemble response team."""
        incident: Incident = context["incident"]
        team_members: List[TeamMember] = context.get("team_members", [])
        
        if not team_members:
            return ActionResult(
                success=False,
                action=step.action,
                tool="slack",
                message="No team members available",
                error="Empty team_members list"
            )
        
        if not incident.slack_channel_id:
            return ActionResult(
                success=False,
                action=step.action,
                tool="slack",
                message="No incident channel available",
                error="Create channel first"
            )
        
        # Filter team members based on incident category and skills
        relevant_members = self._select_relevant_team_members(
            incident, team_members
        )
        
        result = await self.slack.assemble_response_team(
            incident=incident,
            team_members=relevant_members,
            channel_id=incident.slack_channel_id
        )
        
        if result.get("success"):
            incident.assigned_responders = [m.id for m in relevant_members]
        
        return ActionResult(
            success=result.get("success", False),
            action=step.action,
            tool="slack",
            message=f"Assembled {result.get('assembled_count', 0)} team members",
            data=result
        )
    
    async def _handle_analyze_commits(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Analyze recent commits."""
        incident: Incident = context["incident"]
        
        if not self.config.features.github_analysis:
            return ActionResult(
                success=True,
                action=step.action,
                tool="github",
                message="GitHub analysis disabled",
                data={"skipped": True}
            )
        
        repo = step.parameters.get("repo") or f"{self.config.github.org}/main-app"
        hours_back = step.parameters.get("hours_back", 24)
        
        result = await self.github.analyze_recent_commits(
            repo_name=repo,
            hours_back=hours_back,
            affected_paths=incident.affected_services
        )
        
        return ActionResult(
            success=result.get("success", False),
            action=step.action,
            tool="github",
            message=f"Analyzed {result.get('total_commits', 0)} commits",
            data=result
        )
    
    async def _handle_gather_logs(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Gather logs from various sources."""
        # This would integrate with log aggregation systems
        # For demo, return placeholder
        return ActionResult(
            success=True,
            action=step.action,
            tool="logging",
            message="Log gathering initiated",
            data={
                "sources": ["application", "infrastructure"],
                "status": "collecting"
            }
        )
    
    async def _handle_create_postmortem(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Create post-mortem document."""
        incident: Incident = context["incident"]
        
        if not self.config.features.confluence_docs:
            return ActionResult(
                success=True,
                action=step.action,
                tool="confluence",
                message="Confluence docs disabled",
                data={"skipped": True}
            )
        
        result = await self.confluence.create_postmortem(incident)
        
        if result.get("success"):
            incident.confluence_page_id = result.get("page_id")
            return ActionResult(
                success=True,
                action=step.action,
                tool="confluence",
                message=f"Created post-mortem: {result.get('title')}",
                data=result
            )
        
        return ActionResult(
            success=False,
            action=step.action,
            tool="confluence",
            message="Failed to create post-mortem",
            error=result.get("error")
        )
    
    async def _handle_generate_hypothesis(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Generate root cause hypothesis."""
        incident: Incident = context["incident"]
        
        # Get any logs from previous steps
        logs = context.get("results", {}).get("gather_logs", {})
        commits = context.get("results", {}).get("analyze_commits", {})
        
        hypothesis = await self.ai.generate_root_cause_hypothesis(
            incident=incident,
            logs=logs.data.get("logs") if logs and logs.data else None,
            recent_changes=commits.data.get("commits") if commits and commits.data else None
        )
        
        incident.root_cause_hypothesis = hypothesis
        
        return ActionResult(
            success=True,
            action=step.action,
            tool="ai",
            message="Generated root cause hypothesis",
            data={"hypothesis": hypothesis}
        )
    
    async def _handle_search_knowledge(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Search knowledge base for relevant info."""
        incident: Incident = context["incident"]
        
        query = f"{incident.category.value} {' '.join(incident.affected_services[:2])}"
        result = await self.confluence.search_knowledge_base(query)
        
        return ActionResult(
            success=result.get("success", False),
            action=step.action,
            tool="confluence",
            message=f"Found {result.get('total', 0)} relevant articles",
            data=result
        )
    
    async def _handle_post_update(
        self,
        step: WorkflowStep,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Post status update to incident channel."""
        incident: Incident = context["incident"]
        
        if not incident.slack_channel_id:
            return ActionResult(
                success=False,
                action=step.action,
                tool="slack",
                message="No channel available",
                error="No slack_channel_id"
            )
        
        update_type = step.parameters.get("update_type", "status_change")
        details = step.parameters.get("details", "Workflow step completed")
        
        result = await self.slack.post_incident_update(
            channel_id=incident.slack_channel_id,
            incident=incident,
            update_type=update_type,
            details=details
        )
        
        return ActionResult(
            success=result.get("success", False),
            action=step.action,
            tool="slack",
            message="Update posted" if result.get("success") else "Post failed",
            data=result
        )
    
    # ============ Helper Methods ============
    
    def _get_available_tools(self) -> List[str]:
        """Get list of available/enabled tools."""
        tools = []
        
        if self.config.features.auto_ticketing:
            tools.append("servicenow")
        if self.config.features.slack_notifications:
            tools.append("slack")
        if self.config.features.github_analysis:
            tools.append("github")
        if self.config.features.confluence_docs:
            tools.append("confluence")
        
        tools.append("ai")  # Always available
        
        return tools
    
    def _select_relevant_team_members(
        self,
        incident: Incident,
        all_members: List[TeamMember]
    ) -> List[TeamMember]:
        """Select relevant team members based on incident characteristics."""
        # Prioritize on-call members
        on_call = [m for m in all_members if m.on_call]
        
        # Find members with relevant skills
        category_skills = {
            "database": ["postgresql", "mysql", "mongodb", "dba", "sql"],
            "infrastructure": ["kubernetes", "aws", "docker", "sre", "devops"],
            "network": ["networking", "dns", "load-balancer", "firewall"],
            "security": ["security", "soc", "incident-response"],
            "application": ["backend", "frontend", "java", "python", "nodejs"],
            "performance": ["performance", "optimization", "profiling"]
        }
        
        relevant_skills = category_skills.get(incident.category.value, [])
        
        skilled_members = [
            m for m in all_members
            if any(skill in m.skills for skill in relevant_skills)
        ]
        
        # Combine on-call with skilled members, prioritizing on-call
        selected = on_call[:2]  # Max 2 on-call
        
        for member in skilled_members:
            if member not in selected and len(selected) < 5:
                selected.append(member)
        
        # If still need more, add any available
        for member in all_members:
            if member not in selected and len(selected) < 5:
                selected.append(member)
        
        return selected
    
    def _update_incident_from_result(
        self,
        incident: Incident,
        step: WorkflowStep,
        result: ActionResult
    ) -> None:
        """Update incident with step results."""
        if not result.success:
            return
        
        data = result.data or {}
        
        if step.action == "create_ticket":
            incident.servicenow_ticket_id = data.get("number")
        elif step.action == "create_channel":
            incident.slack_channel_id = data.get("channel_id")
        elif step.action == "create_postmortem":
            incident.confluence_page_id = data.get("page_id")
        elif step.action == "generate_hypothesis":
            incident.root_cause_hypothesis = data.get("hypothesis")
    
    def _is_critical_step(self, step: WorkflowStep) -> bool:
        """Determine if a step failure should halt the workflow."""
        # Define which actions are critical
        critical_actions = ["create_ticket"]  # Minimal critical actions
        return step.action in critical_actions
    
    def get_workflow_status(self, workflow_id: str) -> Optional[Workflow]:
        """Get the status of an active workflow."""
        return self.active_workflows.get(workflow_id)
    
    def list_active_workflows(self) -> List[Workflow]:
        """List all active workflows."""
        return list(self.active_workflows.values())


# Singleton instance
_choreographer: Optional[WorkflowChoreographer] = None


def get_choreographer() -> WorkflowChoreographer:
    """Get the workflow choreographer singleton."""
    global _choreographer
    if _choreographer is None:
        _choreographer = WorkflowChoreographer()
    return _choreographer
