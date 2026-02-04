"""
GitHub connector for code analysis and issue tracking.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import structlog
from github import Github, GithubException
from github.Repository import Repository

from ..config import get_config, GitHubConfig
from ..models import Incident

logger = structlog.get_logger()


class GitHubConnector:
    """
    Connector for GitHub integration.
    
    Provides functionality to:
    - Analyze recent commits
    - Create issues for incidents
    - Search for related code changes
    - Gather logs and deployment info
    - Link commits to incidents
    """
    
    def __init__(self, config: Optional[GitHubConfig] = None):
        self.config = config or get_config().github
        self._client: Optional[Github] = None
    
    @property
    def client(self) -> Github:
        """Get or create GitHub client."""
        if self._client is None:
            self._client = Github(self.config.token)
        return self._client
    
    def get_repository(self, repo_name: str) -> Optional[Repository]:
        """Get a repository by name (org/repo or user/repo format)."""
        try:
            return self.client.get_repo(repo_name)
        except GithubException as e:
            logger.error("Failed to get repository", repo=repo_name, error=str(e))
            return None
    
    async def create_incident_issue(
        self,
        incident: Incident,
        repo_name: str
    ) -> Dict[str, Any]:
        """
        Create a GitHub issue for an incident.
        
        Args:
            incident: The incident to create an issue for
            repo_name: Repository name (org/repo format)
            
        Returns:
            Issue details including number and URL
        """
        repo = self.get_repository(repo_name)
        if not repo:
            return {"success": False, "error": f"Repository not found: {repo_name}"}
        
        # Build issue body
        body = self._build_issue_body(incident)
        
        # Determine labels
        labels = self._get_incident_labels(incident)
        
        try:
            issue = repo.create_issue(
                title=f"[INCIDENT] {incident.title}",
                body=body,
                labels=labels
            )
            
            logger.info(
                "GitHub issue created",
                incident_id=incident.id,
                issue_number=issue.number
            )
            
            return {
                "success": True,
                "issue_number": issue.number,
                "issue_url": issue.html_url,
                "issue_id": issue.id
            }
            
        except GithubException as e:
            logger.error("Failed to create issue", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def analyze_recent_commits(
        self,
        repo_name: str,
        hours_back: int = 24,
        affected_paths: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Analyze recent commits that might be related to an incident.
        
        Args:
            repo_name: Repository name
            hours_back: How many hours to look back
            affected_paths: Optional list of paths to filter commits
            
        Returns:
            Analysis results with potentially relevant commits
        """
        repo = self.get_repository(repo_name)
        if not repo:
            return {"success": False, "error": f"Repository not found: {repo_name}"}
        
        since = datetime.utcnow() - timedelta(hours=hours_back)
        
        try:
            commits = list(repo.get_commits(since=since))
            
            relevant_commits = []
            for commit in commits[:50]:  # Limit to last 50 commits
                commit_info = {
                    "sha": commit.sha[:8],
                    "message": commit.commit.message.split("\n")[0][:100],
                    "author": commit.commit.author.name if commit.commit.author else "Unknown",
                    "date": commit.commit.author.date.isoformat() if commit.commit.author else None,
                    "url": commit.html_url
                }
                
                # Check if commit touches affected paths
                if affected_paths:
                    files_changed = [f.filename for f in commit.files]
                    for path in affected_paths:
                        if any(path in f for f in files_changed):
                            commit_info["relevance"] = "high"
                            commit_info["matching_path"] = path
                            break
                    else:
                        commit_info["relevance"] = "low"
                else:
                    commit_info["relevance"] = "unknown"
                
                relevant_commits.append(commit_info)
            
            # Sort by relevance
            relevant_commits.sort(
                key=lambda x: (x.get("relevance") == "high", x.get("date")),
                reverse=True
            )
            
            return {
                "success": True,
                "total_commits": len(commits),
                "analyzed_commits": len(relevant_commits),
                "commits": relevant_commits[:20],  # Return top 20
                "high_relevance_count": sum(1 for c in relevant_commits if c.get("relevance") == "high")
            }
            
        except GithubException as e:
            logger.error("Failed to analyze commits", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def search_code(
        self,
        query: str,
        repo_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for code across repositories.
        
        Args:
            query: Search query
            repo_name: Optional specific repository to search in
        """
        try:
            if repo_name:
                query = f"{query} repo:{repo_name}"
            
            results = self.client.search_code(query)
            
            matches = []
            for item in results[:20]:  # Limit results
                matches.append({
                    "path": item.path,
                    "repository": item.repository.full_name,
                    "url": item.html_url,
                    "sha": item.sha[:8]
                })
            
            return {
                "success": True,
                "total_count": results.totalCount,
                "matches": matches
            }
            
        except GithubException as e:
            logger.error("Failed to search code", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_recent_deployments(
        self,
        repo_name: str,
        environment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get recent deployments for a repository.
        
        Args:
            repo_name: Repository name
            environment: Optional environment filter (e.g., "production")
        """
        repo = self.get_repository(repo_name)
        if not repo:
            return {"success": False, "error": f"Repository not found: {repo_name}"}
        
        try:
            deployments = list(repo.get_deployments())[:10]
            
            deployment_info = []
            for deploy in deployments:
                if environment and deploy.environment != environment:
                    continue
                
                # Get deployment status
                statuses = list(deploy.get_statuses())
                latest_status = statuses[0] if statuses else None
                
                deployment_info.append({
                    "id": deploy.id,
                    "environment": deploy.environment,
                    "ref": deploy.ref,
                    "created_at": deploy.created_at.isoformat(),
                    "creator": deploy.creator.login if deploy.creator else "Unknown",
                    "status": latest_status.state if latest_status else "unknown",
                    "description": deploy.description
                })
            
            return {
                "success": True,
                "deployments": deployment_info
            }
            
        except GithubException as e:
            logger.error("Failed to get deployments", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_workflow_runs(
        self,
        repo_name: str,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get recent GitHub Actions workflow runs.
        
        Args:
            repo_name: Repository name
            status: Optional status filter (e.g., "failure")
        """
        repo = self.get_repository(repo_name)
        if not repo:
            return {"success": False, "error": f"Repository not found: {repo_name}"}
        
        try:
            runs = repo.get_workflow_runs(status=status) if status else repo.get_workflow_runs()
            
            run_info = []
            for run in list(runs)[:20]:
                run_info.append({
                    "id": run.id,
                    "name": run.name,
                    "status": run.status,
                    "conclusion": run.conclusion,
                    "branch": run.head_branch,
                    "commit_sha": run.head_sha[:8],
                    "created_at": run.created_at.isoformat(),
                    "url": run.html_url
                })
            
            return {
                "success": True,
                "runs": run_info,
                "failure_count": sum(1 for r in run_info if r["conclusion"] == "failure")
            }
            
        except GithubException as e:
            logger.error("Failed to get workflow runs", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def add_issue_comment(
        self,
        repo_name: str,
        issue_number: int,
        comment: str
    ) -> Dict[str, Any]:
        """Add a comment to an existing issue."""
        repo = self.get_repository(repo_name)
        if not repo:
            return {"success": False, "error": f"Repository not found: {repo_name}"}
        
        try:
            issue = repo.get_issue(issue_number)
            comment_obj = issue.create_comment(comment)
            
            return {
                "success": True,
                "comment_id": comment_obj.id,
                "comment_url": comment_obj.html_url
            }
            
        except GithubException as e:
            logger.error("Failed to add comment", error=str(e))
            return {"success": False, "error": str(e)}
    
    def _build_issue_body(self, incident: Incident) -> str:
        """Build a detailed GitHub issue body."""
        parts = [
            "## Incident Details",
            "",
            f"**Severity:** {incident.severity.value.upper()}",
            f"**Category:** {incident.category.value}",
            f"**Status:** {incident.status.value}",
            f"**Detected:** {incident.detected_at.isoformat()}",
            "",
            "## Description",
            "",
            incident.description,
            "",
        ]
        
        if incident.affected_services:
            parts.extend([
                "## Affected Services",
                "",
                *[f"- {svc}" for svc in incident.affected_services],
                ""
            ])
        
        if incident.root_cause_hypothesis:
            parts.extend([
                "## Root Cause Hypothesis",
                "",
                incident.root_cause_hypothesis,
                ""
            ])
        
        parts.extend([
            "---",
            f"*Auto-generated by Enterprise Workflow Choreographer*",
            f"*Internal ID: {incident.id}*"
        ])
        
        return "\n".join(parts)
    
    def _get_incident_labels(self, incident: Incident) -> List[str]:
        """Get GitHub labels for an incident."""
        labels = ["incident"]
        
        # Add severity label
        labels.append(f"severity:{incident.severity.value}")
        
        # Add category label
        if incident.category.value != "unknown":
            labels.append(incident.category.value)
        
        return labels


# Singleton instance
_connector: Optional[GitHubConnector] = None


def get_github_connector() -> GitHubConnector:
    """Get the GitHub connector singleton."""
    global _connector
    if _connector is None:
        _connector = GitHubConnector()
    return _connector
