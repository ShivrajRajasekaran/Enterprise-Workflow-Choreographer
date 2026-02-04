"""
Analysis Agent for root cause investigation and log correlation.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import structlog
import re

from ..models import Incident, IncidentCategory
from ..connectors import get_github_connector
from .orchestrator import AIOrchestrator, get_ai_orchestrator

logger = structlog.get_logger()


class AnalysisAgent:
    """
    Agent responsible for incident analysis and investigation.
    
    Capabilities:
    - Log analysis and correlation
    - Code change correlation
    - Root cause hypothesis generation
    - Resolution recommendation
    """
    
    # Patterns to look for in logs
    ERROR_PATTERNS = [
        r"error|exception|failed|failure",
        r"timeout|timed out",
        r"connection refused|connection reset",
        r"out of memory|oom|memory allocation failed",
        r"permission denied|access denied|unauthorized",
        r"null pointer|nullpointerexception|none type",
        r"stack overflow|recursion",
        r"deadlock|lock timeout"
    ]
    
    def __init__(self, ai_orchestrator: Optional[AIOrchestrator] = None):
        self.ai = ai_orchestrator or get_ai_orchestrator()
        self.github = get_github_connector()
    
    async def analyze_incident(
        self,
        incident: Incident,
        logs: Optional[str] = None,
        repos: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Perform comprehensive incident analysis.
        
        Args:
            incident: The incident to analyze
            logs: Log data if available
            repos: GitHub repositories to analyze
            
        Returns:
            Analysis results including hypothesis and recommendations
        """
        logger.info("Starting incident analysis", incident_id=incident.id)
        
        results = {
            "incident_id": incident.id,
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "log_analysis": None,
            "change_analysis": None,
            "hypothesis": None,
            "recommendations": []
        }
        
        # Analyze logs if provided
        if logs:
            results["log_analysis"] = self._analyze_logs(logs, incident)
        
        # Analyze recent code changes
        if repos:
            change_results = []
            for repo in repos:
                changes = await self._analyze_changes(
                    repo,
                    incident,
                    hours_back=24 if incident.severity.value in ["critical", "high"] else 72
                )
                change_results.append(changes)
            results["change_analysis"] = change_results
        
        # Generate AI hypothesis
        recent_commits = []
        if results["change_analysis"]:
            for change in results["change_analysis"]:
                if change.get("commits"):
                    recent_commits.extend(change["commits"][:5])
        
        hypothesis = await self.ai.generate_root_cause_hypothesis(
            incident=incident,
            logs=logs,
            recent_changes=recent_commits,
            metrics=results.get("log_analysis", {}).get("metrics")
        )
        results["hypothesis"] = hypothesis
        
        # Generate recommendations
        results["recommendations"] = self._generate_recommendations(
            incident,
            results["log_analysis"],
            results["change_analysis"]
        )
        
        return results
    
    async def correlate_with_changes(
        self,
        incident: Incident,
        repo: str,
        affected_paths: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Correlate incident with recent code changes.
        
        Args:
            incident: The incident
            repo: Repository to analyze
            affected_paths: Specific paths to look for
            
        Returns:
            Correlation results
        """
        # Determine time window based on severity
        if incident.severity.value == "critical":
            hours_back = 12
        elif incident.severity.value == "high":
            hours_back = 24
        else:
            hours_back = 72
        
        commits = await self.github.analyze_recent_commits(
            repo_name=repo,
            hours_back=hours_back,
            affected_paths=affected_paths
        )
        
        if not commits.get("success"):
            return {"success": False, "error": commits.get("error")}
        
        # Analyze correlation
        high_relevance = [c for c in commits.get("commits", []) if c.get("relevance") == "high"]
        
        # Check for deployment-related commits
        deploy_keywords = ["deploy", "release", "hotfix", "rollback", "config change"]
        deploy_commits = [
            c for c in commits.get("commits", [])
            if any(kw in c.get("message", "").lower() for kw in deploy_keywords)
        ]
        
        return {
            "success": True,
            "total_commits": commits.get("total_commits", 0),
            "high_relevance_commits": high_relevance,
            "deployment_related": deploy_commits,
            "hours_analyzed": hours_back,
            "potential_culprits": high_relevance[:3] if high_relevance else deploy_commits[:3]
        }
    
    async def search_similar_incidents(
        self,
        incident: Incident,
        knowledge_base: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar past incidents.
        
        Args:
            incident: Current incident
            knowledge_base: Knowledge base connector (e.g., Confluence)
            
        Returns:
            List of similar incidents
        """
        # Build search query from incident characteristics
        search_terms = [
            incident.title,
            incident.category.value,
            *incident.affected_services[:2],
            *incident.tags[:3]
        ]
        
        query = " ".join(filter(None, search_terms))
        
        # Search in Confluence if available
        if knowledge_base:
            results = await knowledge_base.search_knowledge_base(query)
            return results.get("results", [])
        
        return []
    
    def _analyze_logs(
        self,
        logs: str,
        incident: Incident
    ) -> Dict[str, Any]:
        """Analyze log content for patterns and anomalies."""
        lines = logs.split("\n")
        
        analysis = {
            "total_lines": len(lines),
            "error_lines": [],
            "patterns_found": [],
            "timestamps": [],
            "metrics": {}
        }
        
        # Find error patterns
        for i, line in enumerate(lines):
            line_lower = line.lower()
            
            # Check for error patterns
            for pattern in self.ERROR_PATTERNS:
                if re.search(pattern, line_lower):
                    analysis["error_lines"].append({
                        "line_number": i + 1,
                        "content": line[:200],
                        "pattern": pattern
                    })
                    
                    if pattern not in analysis["patterns_found"]:
                        analysis["patterns_found"].append(pattern)
                    break
            
            # Try to extract timestamps
            timestamp_match = re.search(
                r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}',
                line
            )
            if timestamp_match and len(analysis["timestamps"]) < 100:
                analysis["timestamps"].append(timestamp_match.group())
        
        # Calculate metrics
        analysis["metrics"] = {
            "error_rate": len(analysis["error_lines"]) / max(len(lines), 1),
            "unique_patterns": len(analysis["patterns_found"]),
            "most_common_error": max(
                analysis["patterns_found"],
                key=lambda p: sum(1 for e in analysis["error_lines"] if e["pattern"] == p),
                default=None
            ) if analysis["patterns_found"] else None
        }
        
        return analysis
    
    async def _analyze_changes(
        self,
        repo: str,
        incident: Incident,
        hours_back: int
    ) -> Dict[str, Any]:
        """Analyze code changes in a repository."""
        # Get commits
        commits_result = await self.github.analyze_recent_commits(
            repo_name=repo,
            hours_back=hours_back,
            affected_paths=incident.affected_services
        )
        
        # Get workflow runs (CI/CD)
        workflows_result = await self.github.get_workflow_runs(
            repo_name=repo,
            status="failure"
        )
        
        # Get deployments
        deployments_result = await self.github.get_recent_deployments(
            repo_name=repo,
            environment="production"
        )
        
        return {
            "repository": repo,
            "commits": commits_result.get("commits", []),
            "failed_workflows": workflows_result.get("runs", []),
            "recent_deployments": deployments_result.get("deployments", []),
            "analysis_period_hours": hours_back
        }
    
    def _generate_recommendations(
        self,
        incident: Incident,
        log_analysis: Optional[Dict[str, Any]],
        change_analysis: Optional[List[Dict[str, Any]]]
    ) -> List[str]:
        """Generate action recommendations based on analysis."""
        recommendations = []
        
        # Based on incident category
        category_recommendations = {
            IncidentCategory.DATABASE: [
                "Check database connection pool utilization",
                "Review recent schema migrations",
                "Verify database server resources (CPU, memory, disk)",
                "Check for long-running queries or locks"
            ],
            IncidentCategory.INFRASTRUCTURE: [
                "Check server/container resource utilization",
                "Review recent infrastructure changes",
                "Verify network connectivity between services",
                "Check for scaling events or failures"
            ],
            IncidentCategory.NETWORK: [
                "Check DNS resolution",
                "Verify load balancer health checks",
                "Review firewall rules and security groups",
                "Check for network saturation"
            ],
            IncidentCategory.SECURITY: [
                "Review authentication logs",
                "Check for unusual access patterns",
                "Verify API key and certificate validity",
                "Review security group changes"
            ],
            IncidentCategory.APPLICATION: [
                "Review application error logs",
                "Check for recent deployments",
                "Verify configuration changes",
                "Check external service dependencies"
            ],
            IncidentCategory.PERFORMANCE: [
                "Review application metrics and traces",
                "Check for resource contention",
                "Profile slow endpoints or queries",
                "Review caching effectiveness"
            ]
        }
        
        recommendations.extend(
            category_recommendations.get(incident.category, [])[:3]
        )
        
        # Based on log analysis
        if log_analysis:
            if log_analysis.get("metrics", {}).get("error_rate", 0) > 0.1:
                recommendations.append(
                    "High error rate detected - prioritize error log investigation"
                )
            
            most_common = log_analysis.get("metrics", {}).get("most_common_error")
            if most_common:
                if "timeout" in most_common:
                    recommendations.append("Investigate timeout issues - check dependent service health")
                elif "memory" in most_common:
                    recommendations.append("Memory issues detected - consider scaling or leak investigation")
                elif "connection" in most_common:
                    recommendations.append("Connection issues detected - verify network and service availability")
        
        # Based on change analysis
        if change_analysis:
            for repo_changes in change_analysis:
                if repo_changes.get("recent_deployments"):
                    recommendations.append(
                        f"Recent deployment detected in {repo_changes.get('repository')} - consider rollback if needed"
                    )
                
                if repo_changes.get("failed_workflows"):
                    recommendations.append(
                        "Failed CI/CD workflows detected - verify build and deployment status"
                    )
        
        return recommendations[:7]  # Limit recommendations


# Singleton instance
_agent: Optional[AnalysisAgent] = None


def get_analysis_agent() -> AnalysisAgent:
    """Get the analysis agent singleton."""
    global _agent
    if _agent is None:
        _agent = AnalysisAgent()
    return _agent
