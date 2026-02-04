"""
Jira connector for issue tracking and team assignment.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import structlog
from atlassian import Jira

from ..config import get_config
from ..models import Incident, IncidentSeverity

logger = structlog.get_logger()


class JiraConnector:
    """
    Connector for Jira integration.
    
    Provides functionality to:
    - Create issues for incidents
    - Assign issues to teams/users
    - Update issue status
    - Add comments and attachments
    - Search for related issues
    """
    
    PRIORITY_MAP = {
        IncidentSeverity.CRITICAL: "Highest",
        IncidentSeverity.HIGH: "High",
        IncidentSeverity.MEDIUM: "Medium",
        IncidentSeverity.LOW: "Low",
    }
    
    def __init__(self, config=None):
        self.config = config or get_config().jira
        self._client: Optional[Jira] = None
    
    @property
    def client(self) -> Jira:
        """Get or create Jira client."""
        if self._client is None:
            self._client = Jira(
                url=self.config.url,
                username=self.config.username,
                password=self.config.api_token,
                cloud=True
            )
        return self._client
    
    async def create_incident_issue(
        self,
        incident: Incident,
        project_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a Jira issue for an incident.
        
        Args:
            incident: The incident to create an issue for
            project_key: Jira project key (defaults to config)
            
        Returns:
            Issue details including key and URL
        """
        project = project_key or self.config.project_key
        
        # Build issue description
        description = self._build_description(incident)
        
        # Map severity to priority
        priority = self.PRIORITY_MAP.get(incident.severity, "Medium")
        
        logger.info("Creating Jira issue", incident_id=incident.id, project=project)
        
        try:
            issue_dict = {
                "project": {"key": project},
                "summary": f"[INCIDENT] {incident.title}",
                "description": description,
                "issuetype": {"name": "Bug"},  # Or "Incident" if configured
                "priority": {"name": priority},
                "labels": self._get_labels(incident)
            }
            
            result = self.client.create_issue(fields=issue_dict)
            
            issue_key = result.get("key")
            issue_url = f"{self.config.url}/browse/{issue_key}"
            
            logger.info(
                "Jira issue created",
                incident_id=incident.id,
                issue_key=issue_key
            )
            
            return {
                "success": True,
                "issue_key": issue_key,
                "issue_id": result.get("id"),
                "issue_url": issue_url
            }
            
        except Exception as e:
            logger.error("Failed to create Jira issue", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def assign_issue(
        self,
        issue_key: str,
        assignee_email: str
    ) -> Dict[str, Any]:
        """
        Assign an issue to a user.
        
        Args:
            issue_key: Jira issue key (e.g., "INC-123")
            assignee_email: Email of the user to assign to
        """
        try:
            # Get account ID from email
            users = self.client.user_find_by_user_string(query=assignee_email)
            
            if not users:
                return {
                    "success": False,
                    "error": f"User not found: {assignee_email}"
                }
            
            account_id = users[0].get("accountId")
            
            self.client.assign_issue(issue_key, account_id)
            
            logger.info("Issue assigned", issue_key=issue_key, assignee=assignee_email)
            
            return {
                "success": True,
                "issue_key": issue_key,
                "assignee": assignee_email
            }
            
        except Exception as e:
            logger.error("Failed to assign issue", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def add_comment(
        self,
        issue_key: str,
        comment: str
    ) -> Dict[str, Any]:
        """Add a comment to an issue."""
        try:
            self.client.issue_add_comment(issue_key, comment)
            
            return {"success": True, "issue_key": issue_key}
            
        except Exception as e:
            logger.error("Failed to add comment", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def transition_issue(
        self,
        issue_key: str,
        transition_name: str
    ) -> Dict[str, Any]:
        """
        Transition an issue to a new status.
        
        Args:
            issue_key: Jira issue key
            transition_name: Name of the transition (e.g., "In Progress", "Done")
        """
        try:
            # Get available transitions
            transitions = self.client.get_issue_transitions(issue_key)
            
            # Find matching transition
            transition_id = None
            for t in transitions.get("transitions", []):
                if t["name"].lower() == transition_name.lower():
                    transition_id = t["id"]
                    break
            
            if not transition_id:
                return {
                    "success": False,
                    "error": f"Transition not found: {transition_name}"
                }
            
            self.client.issue_transition(issue_key, transition_id)
            
            logger.info(
                "Issue transitioned",
                issue_key=issue_key,
                transition=transition_name
            )
            
            return {"success": True, "issue_key": issue_key, "new_status": transition_name}
            
        except Exception as e:
            logger.error("Failed to transition issue", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def search_similar_issues(
        self,
        incident: Incident,
        max_results: int = 5
    ) -> Dict[str, Any]:
        """
        Search for similar issues in Jira.
        
        Args:
            incident: Incident to find similar issues for
            max_results: Maximum number of results
        """
        try:
            # Build JQL query
            labels = " OR ".join([f'labels = "{label}"' for label in incident.tags[:3]])
            jql = f'project = {self.config.project_key} AND ({labels}) ORDER BY created DESC'
            
            results = self.client.jql(jql, limit=max_results)
            
            issues = []
            for issue in results.get("issues", []):
                issues.append({
                    "key": issue["key"],
                    "summary": issue["fields"]["summary"],
                    "status": issue["fields"]["status"]["name"],
                    "url": f"{self.config.url}/browse/{issue['key']}"
                })
            
            return {
                "success": True,
                "issues": issues,
                "total": results.get("total", 0)
            }
            
        except Exception as e:
            logger.error("Failed to search issues", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_team_members(
        self,
        project_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get team members for a project."""
        try:
            project = project_key or self.config.project_key
            
            # Get project roles
            roles = self.client.get_project_roles(project)
            
            members = []
            for role_name, role_url in roles.items():
                role_data = self.client.get_project_role(project, role_name)
                for actor in role_data.get("actors", []):
                    members.append({
                        "name": actor.get("displayName"),
                        "email": actor.get("name"),
                        "role": role_name
                    })
            
            return {"success": True, "members": members}
            
        except Exception as e:
            logger.error("Failed to get team members", error=str(e))
            return {"success": False, "error": str(e)}
    
    def _build_description(self, incident: Incident) -> str:
        """Build a Jira-formatted description."""
        parts = [
            f"h2. Incident Details",
            "",
            f"*Severity:* {incident.severity.value.upper()}",
            f"*Category:* {incident.category.value}",
            f"*Status:* {incident.status.value}",
            f"*Detected:* {incident.detected_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
            "",
            "h3. Description",
            incident.description,
            "",
        ]
        
        if incident.affected_services:
            parts.extend([
                "h3. Affected Services",
                *[f"* {svc}" for svc in incident.affected_services],
                ""
            ])
        
        if incident.root_cause_hypothesis:
            parts.extend([
                "h3. Root Cause Hypothesis",
                incident.root_cause_hypothesis,
                ""
            ])
        
        parts.extend([
            "----",
            f"_Auto-generated by Enterprise Workflow Choreographer_",
            f"_Internal ID: {incident.id}_"
        ])
        
        return "\n".join(parts)
    
    def _get_labels(self, incident: Incident) -> List[str]:
        """Get Jira labels for an incident."""
        labels = ["incident", incident.severity.value]
        
        if incident.category.value != "unknown":
            labels.append(incident.category.value)
        
        # Add first few tags
        labels.extend(incident.tags[:3])
        
        # Clean labels (Jira doesn't allow spaces)
        return [label.replace(" ", "-") for label in labels]


# Singleton instance
_connector: Optional[JiraConnector] = None


def get_jira_connector() -> JiraConnector:
    """Get the Jira connector singleton."""
    global _connector
    if _connector is None:
        _connector = JiraConnector()
    return _connector
