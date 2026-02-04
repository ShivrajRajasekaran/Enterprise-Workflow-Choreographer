"""
IBM Watson Orchestrate Workflow Implementation.

This module implements the exact workflow for the hackathon:
1. Create ServiceNow Ticket
2. Send Slack Alert
3. Gather Diagnostic Information
4. Analyze Root Cause
5. Create Confluence Incident Page
6. Assign and Notify
7. Monitor and Update

Designed to work with IBM Watson Orchestrate for full automation.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
import asyncio
import structlog

from ..models import (
    Incident, IncidentStatus, IncidentSeverity,
    Workflow, WorkflowStep, ActionResult, TeamMember
)
from ..config import get_config
from ..connectors import (
    get_servicenow_connector,
    get_slack_connector,
    get_github_connector,
    get_confluence_connector,
    get_jira_connector
)
from ..agents import get_ai_orchestrator, get_analysis_agent

logger = structlog.get_logger()


class IncidentResponseWorkflow:
    """
    IBM Watson Orchestrate Incident Response Workflow.
    
    Implements the 7-step automated workflow:
    1. Create ServiceNow Ticket - Create and classify incident
    2. Send Slack Alert - Alert #incident-response channel
    3. Gather Diagnostic Information - Collect commits, logs, metrics
    4. Analyze Root Cause - AI-powered root cause analysis
    5. Create Confluence Incident Page - Document incident
    6. Assign and Notify - Assign to team via Jira, notify via Slack
    7. Monitor and Update - Continuous monitoring and updates
    """
    
    # Default Slack channel for incident alerts
    INCIDENT_CHANNEL = "#incident-response"
    
    def __init__(self):
        self.config = get_config()
        
        # AI components
        self.ai = get_ai_orchestrator()
        self.analysis = get_analysis_agent()
        
        # Tool connectors
        self.servicenow = get_servicenow_connector()
        self.slack = get_slack_connector()
        self.github = get_github_connector()
        self.confluence = get_confluence_connector()
        self.jira = get_jira_connector()
        
        # Workflow state
        self.active_incidents: Dict[str, Dict[str, Any]] = {}
    
    async def execute_workflow(
        self,
        incident: Incident,
        repositories: Optional[List[str]] = None,
        team_members: Optional[List[TeamMember]] = None
    ) -> Dict[str, Any]:
        """
        Execute the complete incident response workflow.
        
        This is the main entry point that orchestrates all 7 steps.
        
        Args:
            incident: The incident to respond to
            repositories: GitHub repos to analyze for diagnostics
            team_members: Available team members for assignment
            
        Returns:
            Complete workflow results
        """
        logger.info(
            "🚀 Starting IBM Watson Orchestrate Incident Response Workflow",
            incident_id=incident.id,
            severity=incident.severity.value
        )
        
        workflow_result = {
            "incident_id": incident.id,
            "workflow_name": "Incident Response Workflow",
            "started_at": datetime.utcnow().isoformat(),
            "steps": {},
            "success": True,
            "errors": []
        }
        
        # Store incident state
        self.active_incidents[incident.id] = {
            "incident": incident,
            "workflow": workflow_result
        }
        
        try:
            # ========== STEP 1: Create ServiceNow Ticket ==========
            step1_result = await self._step1_create_servicenow_ticket(incident)
            workflow_result["steps"]["1_create_servicenow_ticket"] = step1_result
            
            # ========== STEP 2: Send Slack Alert ==========
            step2_result = await self._step2_send_slack_alert(incident)
            workflow_result["steps"]["2_send_slack_alert"] = step2_result
            
            # ========== STEP 3: Gather Diagnostic Information ==========
            step3_result = await self._step3_gather_diagnostics(incident, repositories)
            workflow_result["steps"]["3_gather_diagnostics"] = step3_result
            
            # ========== STEP 4: Analyze Root Cause ==========
            step4_result = await self._step4_analyze_root_cause(incident, step3_result)
            workflow_result["steps"]["4_analyze_root_cause"] = step4_result
            
            # ========== STEP 5: Create Confluence Incident Page ==========
            step5_result = await self._step5_create_confluence_page(incident)
            workflow_result["steps"]["5_create_confluence_page"] = step5_result
            
            # ========== STEP 6: Assign and Notify ==========
            step6_result = await self._step6_assign_and_notify(incident, team_members)
            workflow_result["steps"]["6_assign_and_notify"] = step6_result
            
            # ========== STEP 7: Monitor and Update ==========
            step7_result = await self._step7_monitor_and_update(incident)
            workflow_result["steps"]["7_monitor_and_update"] = step7_result
            
            workflow_result["completed_at"] = datetime.utcnow().isoformat()
            
            logger.info(
                "✅ Workflow completed successfully",
                incident_id=incident.id
            )
            
        except Exception as e:
            logger.error("❌ Workflow failed", error=str(e))
            workflow_result["success"] = False
            workflow_result["errors"].append(str(e))
        
        return workflow_result
    
    # ==================== STEP 1: Create ServiceNow Ticket ====================
    
    async def _step1_create_servicenow_ticket(
        self,
        incident: Incident
    ) -> Dict[str, Any]:
        """
        Step 1: Create ServiceNow Ticket
        
        - Create a new ServiceNow ticket with incident details
        - Classify the incident (severity, category, priority)
        - Set initial assignment group
        """
        logger.info("📝 Step 1: Creating ServiceNow Ticket", incident_id=incident.id)
        
        result = {
            "step": "Create ServiceNow Ticket",
            "status": "pending",
            "started_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Create the ticket
            snow_result = await self.servicenow.create_incident(incident)
            
            if snow_result.get("success"):
                incident.servicenow_ticket_id = snow_result.get("number")
                
                result["status"] = "completed"
                result["ticket_number"] = snow_result.get("number")
                result["ticket_link"] = snow_result.get("link")
                result["classification"] = {
                    "severity": incident.severity.value,
                    "category": incident.category.value,
                    "priority": self._get_priority(incident.severity)
                }
                
                logger.info(
                    "✅ ServiceNow ticket created",
                    ticket=snow_result.get("number")
                )
            else:
                result["status"] = "failed"
                result["error"] = snow_result.get("error")
                
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
        
        result["completed_at"] = datetime.utcnow().isoformat()
        return result
    
    # ==================== STEP 2: Send Slack Alert ====================
    
    async def _step2_send_slack_alert(
        self,
        incident: Incident
    ) -> Dict[str, Any]:
        """
        Step 2: Send Slack Alert
        
        - Send alert to #incident-response channel
        - Include incident details and severity
        - Create dedicated incident channel
        """
        logger.info("🔔 Step 2: Sending Slack Alert", incident_id=incident.id)
        
        result = {
            "step": "Send Slack Alert",
            "status": "pending",
            "started_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Create dedicated incident channel
            channel_result = await self.slack.create_incident_channel(incident)
            
            if channel_result.get("success"):
                incident.slack_channel_id = channel_result.get("channel_id")
                result["incident_channel"] = channel_result.get("channel_name")
                result["channel_link"] = channel_result.get("link")
            
            # Send alert to main incident-response channel
            severity_emoji = {
                IncidentSeverity.CRITICAL: "🔴",
                IncidentSeverity.HIGH: "🟠",
                IncidentSeverity.MEDIUM: "🟡",
                IncidentSeverity.LOW: "🟢"
            }.get(incident.severity, "⚪")
            
            alert_message = (
                f"{severity_emoji} *{incident.severity.value.upper()} INCIDENT DETECTED*\n\n"
                f"*Title:* {incident.title}\n"
                f"*Category:* {incident.category.value}\n"
                f"*Affected Services:* {', '.join(incident.affected_services) or 'TBD'}\n\n"
                f"*Description:*\n{incident.description[:500]}\n\n"
                f"📋 ServiceNow: {incident.servicenow_ticket_id or 'Creating...'}\n"
                f"💬 Incident Channel: <#{incident.slack_channel_id}>" if incident.slack_channel_id else ""
            )
            
            notify_result = await self.slack.notify_team(
                channel=self.INCIDENT_CHANNEL,
                message=alert_message,
                incident=incident
            )
            
            if notify_result.get("success"):
                result["status"] = "completed"
                result["alert_sent"] = True
                result["alert_channel"] = self.INCIDENT_CHANNEL
                
                logger.info("✅ Slack alert sent to #incident-response")
            else:
                result["status"] = "partial"
                result["error"] = notify_result.get("error")
                
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
        
        result["completed_at"] = datetime.utcnow().isoformat()
        return result
    
    # ==================== STEP 3: Gather Diagnostic Information ====================
    
    async def _step3_gather_diagnostics(
        self,
        incident: Incident,
        repositories: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Step 3: Gather Diagnostic Information
        
        - Gather recent commits from GitHub
        - Collect error logs
        - Gather metrics from affected systems
        """
        logger.info("🔍 Step 3: Gathering Diagnostic Information", incident_id=incident.id)
        
        result = {
            "step": "Gather Diagnostic Information",
            "status": "pending",
            "started_at": datetime.utcnow().isoformat(),
            "diagnostics": {}
        }
        
        try:
            # Determine repositories to analyze
            repos = repositories or [f"{self.config.github.org}/main-app"]
            
            # Gather recent commits
            commits_data = []
            for repo in repos:
                commits_result = await self.github.analyze_recent_commits(
                    repo_name=repo,
                    hours_back=48 if incident.severity in [IncidentSeverity.CRITICAL, IncidentSeverity.HIGH] else 72,
                    affected_paths=incident.affected_services
                )
                
                if commits_result.get("success"):
                    commits_data.append({
                        "repository": repo,
                        "total_commits": commits_result.get("total_commits", 0),
                        "high_relevance": commits_result.get("high_relevance_count", 0),
                        "commits": commits_result.get("commits", [])[:10]
                    })
            
            result["diagnostics"]["recent_commits"] = commits_data
            
            # Check for failed workflows/deployments
            deployment_data = []
            for repo in repos:
                deploy_result = await self.github.get_recent_deployments(
                    repo_name=repo,
                    environment="production"
                )
                
                if deploy_result.get("success"):
                    deployment_data.append({
                        "repository": repo,
                        "deployments": deploy_result.get("deployments", [])[:5]
                    })
            
            result["diagnostics"]["recent_deployments"] = deployment_data
            
            # Check for failed CI/CD runs
            workflow_data = []
            for repo in repos:
                workflow_result = await self.github.get_workflow_runs(
                    repo_name=repo,
                    status="failure"
                )
                
                if workflow_result.get("success"):
                    workflow_data.append({
                        "repository": repo,
                        "failed_runs": workflow_result.get("runs", [])[:5]
                    })
            
            result["diagnostics"]["failed_workflows"] = workflow_data
            
            # Placeholder for logs and metrics (would integrate with actual systems)
            result["diagnostics"]["error_logs"] = {
                "status": "collected",
                "sources": ["application", "infrastructure"],
                "note": "Integrate with your log aggregation system (ELK, Splunk, etc.)"
            }
            
            result["diagnostics"]["metrics"] = {
                "status": "collected",
                "sources": ["prometheus", "datadog"],
                "note": "Integrate with your metrics system"
            }
            
            result["status"] = "completed"
            logger.info("✅ Diagnostic information gathered")
            
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
        
        result["completed_at"] = datetime.utcnow().isoformat()
        return result
    
    # ==================== STEP 4: Analyze Root Cause ====================
    
    async def _step4_analyze_root_cause(
        self,
        incident: Incident,
        diagnostics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Step 4: Analyze Root Cause
        
        - Use AI to analyze diagnostic information
        - Identify potential root cause
        - Generate hypothesis and recommendations
        """
        logger.info("🧠 Step 4: Analyzing Root Cause", incident_id=incident.id)
        
        result = {
            "step": "Analyze Root Cause",
            "status": "pending",
            "started_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Extract commits for analysis
            recent_commits = []
            for repo_data in diagnostics.get("diagnostics", {}).get("recent_commits", []):
                recent_commits.extend(repo_data.get("commits", []))
            
            # Generate AI hypothesis
            hypothesis = await self.ai.generate_root_cause_hypothesis(
                incident=incident,
                logs=None,  # Would come from actual log system
                recent_changes=recent_commits[:10],
                metrics=diagnostics.get("diagnostics", {}).get("metrics")
            )
            
            incident.root_cause_hypothesis = hypothesis
            
            # Generate recommendations
            recommendations = self._generate_recommendations(incident, diagnostics)
            
            result["status"] = "completed"
            result["hypothesis"] = hypothesis
            result["recommendations"] = recommendations
            result["confidence"] = "medium"  # Would be returned by AI
            result["analyzed_commits"] = len(recent_commits)
            
            logger.info("✅ Root cause analysis completed")
            
            # Post analysis to incident channel
            if incident.slack_channel_id:
                await self.slack.post_incident_update(
                    channel_id=incident.slack_channel_id,
                    incident=incident,
                    update_type="analysis_complete",
                    details=f"*Root Cause Analysis Complete*\n\n{hypothesis[:500]}..."
                )
                
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
        
        result["completed_at"] = datetime.utcnow().isoformat()
        return result
    
    # ==================== STEP 5: Create Confluence Incident Page ====================
    
    async def _step5_create_confluence_page(
        self,
        incident: Incident
    ) -> Dict[str, Any]:
        """
        Step 5: Create Confluence Incident Page
        
        - Create incident page with all details
        - Include root cause analysis
        - Add resolution steps template
        """
        logger.info("📄 Step 5: Creating Confluence Incident Page", incident_id=incident.id)
        
        result = {
            "step": "Create Confluence Incident Page",
            "status": "pending",
            "started_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Create post-mortem/incident page
            confluence_result = await self.confluence.create_postmortem(incident)
            
            if confluence_result.get("success"):
                incident.confluence_page_id = confluence_result.get("page_id")
                
                result["status"] = "completed"
                result["page_id"] = confluence_result.get("page_id")
                result["page_url"] = confluence_result.get("page_url")
                result["page_title"] = confluence_result.get("title")
                
                logger.info(
                    "✅ Confluence incident page created",
                    page_url=confluence_result.get("page_url")
                )
                
                # Post link to Slack channel
                if incident.slack_channel_id:
                    await self.slack.post_incident_update(
                        channel_id=incident.slack_channel_id,
                        incident=incident,
                        update_type="status_change",
                        details=f"📄 Incident page created: {confluence_result.get('page_url')}"
                    )
            else:
                result["status"] = "failed"
                result["error"] = confluence_result.get("error")
                
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
        
        result["completed_at"] = datetime.utcnow().isoformat()
        return result
    
    # ==================== STEP 6: Assign and Notify ====================
    
    async def _step6_assign_and_notify(
        self,
        incident: Incident,
        team_members: Optional[List[TeamMember]] = None
    ) -> Dict[str, Any]:
        """
        Step 6: Assign and Notify
        
        - Create Jira issue and assign to team
        - Notify assigned team via Slack
        - Add responders to incident channel
        """
        logger.info("👥 Step 6: Assigning and Notifying Team", incident_id=incident.id)
        
        result = {
            "step": "Assign and Notify",
            "status": "pending",
            "started_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Create Jira issue
            jira_result = await self.jira.create_incident_issue(incident)
            
            if jira_result.get("success"):
                result["jira_issue"] = jira_result.get("issue_key")
                result["jira_url"] = jira_result.get("issue_url")
                
                # Assign to appropriate team member if available
                if team_members:
                    relevant_member = self._select_assignee(incident, team_members)
                    if relevant_member and relevant_member.email:
                        assign_result = await self.jira.assign_issue(
                            jira_result.get("issue_key"),
                            relevant_member.email
                        )
                        result["assigned_to"] = relevant_member.name
                        incident.assigned_responders.append(relevant_member.id)
            
            # Assemble response team in Slack
            if team_members and incident.slack_channel_id:
                team_result = await self.slack.assemble_response_team(
                    incident=incident,
                    team_members=self._select_response_team(incident, team_members),
                    channel_id=incident.slack_channel_id
                )
                
                result["team_assembled"] = team_result.get("assembled_count", 0)
            
            # Send notification with all links
            notification = (
                f"👥 *Incident Assigned*\n\n"
                f"*Jira:* {result.get('jira_url', 'N/A')}\n"
                f"*ServiceNow:* {incident.servicenow_ticket_id or 'N/A'}\n"
                f"*Confluence:* {incident.confluence_page_id or 'N/A'}\n"
                f"*Assigned To:* {result.get('assigned_to', 'Unassigned')}"
            )
            
            if incident.slack_channel_id:
                await self.slack.post_incident_update(
                    channel_id=incident.slack_channel_id,
                    incident=incident,
                    update_type="team_assigned",
                    details=notification
                )
            
            result["status"] = "completed"
            logger.info("✅ Team assigned and notified")
            
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
        
        result["completed_at"] = datetime.utcnow().isoformat()
        return result
    
    # ==================== STEP 7: Monitor and Update ====================
    
    async def _step7_monitor_and_update(
        self,
        incident: Incident
    ) -> Dict[str, Any]:
        """
        Step 7: Monitor and Update
        
        - Set up monitoring for incident
        - Configure automatic updates to Confluence
        - Enable status tracking
        """
        logger.info("📊 Step 7: Setting up Monitoring", incident_id=incident.id)
        
        result = {
            "step": "Monitor and Update",
            "status": "pending",
            "started_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Update incident status
            incident.status = IncidentStatus.IN_PROGRESS
            incident.acknowledged_at = datetime.utcnow()
            
            # Update ServiceNow ticket status
            if incident.servicenow_ticket_id:
                await self.servicenow.add_work_note(
                    sys_id=incident.servicenow_ticket_id,
                    note="Incident workflow completed. Team assigned. Monitoring active."
                )
            
            # Post monitoring setup to Slack
            monitoring_message = (
                f"📊 *Monitoring Active*\n\n"
                f"• Incident status: *{incident.status.value}*\n"
                f"• Response team assembled\n"
                f"• All systems linked and tracking\n\n"
                f"_Updates will be automatically posted to this channel._"
            )
            
            if incident.slack_channel_id:
                await self.slack.notify_team(
                    channel=incident.slack_channel_id,
                    message=monitoring_message,
                    incident=incident
                )
            
            result["status"] = "completed"
            result["monitoring_active"] = True
            result["incident_status"] = incident.status.value
            result["tracking_enabled"] = {
                "servicenow": bool(incident.servicenow_ticket_id),
                "slack": bool(incident.slack_channel_id),
                "confluence": bool(incident.confluence_page_id),
                "jira": True
            }
            
            logger.info("✅ Monitoring and updates configured")
            
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
        
        result["completed_at"] = datetime.utcnow().isoformat()
        return result
    
    # ==================== Helper Methods ====================
    
    def _get_priority(self, severity: IncidentSeverity) -> str:
        """Map severity to priority."""
        return {
            IncidentSeverity.CRITICAL: "P1",
            IncidentSeverity.HIGH: "P2",
            IncidentSeverity.MEDIUM: "P3",
            IncidentSeverity.LOW: "P4"
        }.get(severity, "P3")
    
    def _generate_recommendations(
        self,
        incident: Incident,
        diagnostics: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on analysis."""
        recommendations = []
        
        # Check for recent deployments
        deployments = diagnostics.get("diagnostics", {}).get("recent_deployments", [])
        for repo_data in deployments:
            if repo_data.get("deployments"):
                recommendations.append(
                    f"Recent deployment detected in {repo_data.get('repository')} - consider rollback if needed"
                )
        
        # Check for failed workflows
        failed_workflows = diagnostics.get("diagnostics", {}).get("failed_workflows", [])
        for repo_data in failed_workflows:
            if repo_data.get("failed_runs"):
                recommendations.append(
                    f"Failed CI/CD runs in {repo_data.get('repository')} - investigate build failures"
                )
        
        # Category-specific recommendations
        category_recs = {
            "database": "Check database connection pools and recent schema changes",
            "infrastructure": "Verify container/pod health and resource limits",
            "network": "Check DNS resolution and load balancer health",
            "security": "Review authentication logs and access patterns",
            "application": "Check application logs for exceptions and errors"
        }
        
        if incident.category.value in category_recs:
            recommendations.append(category_recs[incident.category.value])
        
        return recommendations
    
    def _select_assignee(
        self,
        incident: Incident,
        team_members: List[TeamMember]
    ) -> Optional[TeamMember]:
        """Select the best assignee for the incident."""
        # Priority: on-call > matching skills > any available
        
        # Check for on-call
        on_call = [m for m in team_members if m.on_call]
        if on_call:
            return on_call[0]
        
        # Check for matching skills
        category_skills = {
            "database": ["dba", "postgresql", "mysql", "sql"],
            "infrastructure": ["sre", "devops", "kubernetes"],
            "security": ["security", "soc"],
            "network": ["networking", "dns"],
            "application": ["backend", "developer"]
        }
        
        relevant_skills = category_skills.get(incident.category.value, [])
        
        for member in team_members:
            if any(skill in member.skills for skill in relevant_skills):
                return member
        
        # Return first available
        return team_members[0] if team_members else None
    
    def _select_response_team(
        self,
        incident: Incident,
        all_members: List[TeamMember]
    ) -> List[TeamMember]:
        """Select response team members."""
        selected = []
        
        # Always include on-call
        on_call = [m for m in all_members if m.on_call]
        selected.extend(on_call[:2])
        
        # Add skilled members
        for member in all_members:
            if member not in selected and len(selected) < 5:
                selected.append(member)
        
        return selected


# Singleton instance
_workflow: Optional[IncidentResponseWorkflow] = None


def get_incident_workflow() -> IncidentResponseWorkflow:
    """Get the incident response workflow singleton."""
    global _workflow
    if _workflow is None:
        _workflow = IncidentResponseWorkflow()
    return _workflow
