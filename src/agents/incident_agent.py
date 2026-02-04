"""
Incident Detection and Classification Agent.

Responsible for:
- Monitoring incoming alerts from various sources
- Classifying incidents automatically
- Triggering appropriate workflows
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import structlog

from ..models import (
    Incident, IncidentSeverity, IncidentCategory, IncidentStatus
)
from .orchestrator import AIOrchestrator, get_ai_orchestrator

logger = structlog.get_logger()


class IncidentAgent:
    """
    Agent responsible for incident detection and initial processing.
    
    Handles:
    - Alert ingestion from monitoring tools
    - Incident creation and classification
    - Initial triage decisions
    """
    
    # Mapping of common alert sources to their severity indicators
    SEVERITY_KEYWORDS = {
        IncidentSeverity.CRITICAL: [
            "critical", "fatal", "emergency", "outage", "down",
            "production down", "data loss", "security breach"
        ],
        IncidentSeverity.HIGH: [
            "high", "severe", "major", "degraded", "failing",
            "error rate spike", "latency", "timeout"
        ],
        IncidentSeverity.MEDIUM: [
            "medium", "warning", "elevated", "increased",
            "performance", "slow"
        ],
        IncidentSeverity.LOW: [
            "low", "minor", "info", "informational", "notice"
        ]
    }
    
    CATEGORY_KEYWORDS = {
        IncidentCategory.DATABASE: [
            "database", "db", "sql", "postgres", "mysql", "mongodb",
            "connection pool", "query", "deadlock", "replication"
        ],
        IncidentCategory.INFRASTRUCTURE: [
            "server", "vm", "container", "kubernetes", "k8s", "pod",
            "node", "cluster", "disk", "memory", "cpu"
        ],
        IncidentCategory.NETWORK: [
            "network", "dns", "load balancer", "firewall", "timeout",
            "connection refused", "unreachable", "latency"
        ],
        IncidentCategory.SECURITY: [
            "security", "unauthorized", "breach", "attack", "vulnerability",
            "authentication", "permission", "access denied"
        ],
        IncidentCategory.APPLICATION: [
            "application", "api", "service", "endpoint", "error",
            "exception", "crash", "null pointer"
        ],
        IncidentCategory.PERFORMANCE: [
            "performance", "slow", "latency", "response time",
            "throughput", "bottleneck", "queue"
        ]
    }
    
    def __init__(self, ai_orchestrator: Optional[AIOrchestrator] = None):
        self.ai = ai_orchestrator or get_ai_orchestrator()
    
    async def process_alert(
        self,
        alert_data: Dict[str, Any],
        source: str
    ) -> Incident:
        """
        Process an incoming alert and create an incident.
        
        Args:
            alert_data: Raw alert data from monitoring tool
            source: Source system (e.g., "datadog", "pagerduty", "prometheus")
            
        Returns:
            Created incident
        """
        logger.info("Processing alert", source=source)
        
        # Extract basic information based on source format
        title, description = self._extract_alert_info(alert_data, source)
        
        # Perform AI classification
        classification = await self.ai.classify_incident(
            title=title,
            description=description,
            source_data=alert_data
        )
        
        # Create incident with classification results
        context = classification.context_used
        
        incident = Incident(
            title=title,
            description=description,
            severity=IncidentSeverity(context.get("severity", "medium")),
            category=IncidentCategory(context.get("category", "unknown")),
            status=IncidentStatus.DETECTED,
            source_system=source,
            source_alert_id=alert_data.get("alert_id") or alert_data.get("id"),
            affected_services=context.get("affected_systems", []),
            tags=self._extract_tags(alert_data),
            metadata={
                "ai_confidence": classification.confidence,
                "ai_reasoning": classification.reasoning,
                "original_alert": alert_data
            }
        )
        
        logger.info(
            "Incident created from alert",
            incident_id=incident.id,
            severity=incident.severity.value,
            category=incident.category.value
        )
        
        return incident
    
    async def process_manual_report(
        self,
        title: str,
        description: str,
        reporter: str,
        affected_services: Optional[List[str]] = None,
        initial_severity: Optional[IncidentSeverity] = None
    ) -> Incident:
        """
        Process a manually reported incident.
        
        Args:
            title: Incident title
            description: Detailed description
            reporter: Who reported the incident
            affected_services: Known affected services
            initial_severity: Reporter's severity assessment
        """
        logger.info("Processing manual incident report", reporter=reporter)
        
        # Use AI to validate/refine classification
        classification = await self.ai.classify_incident(
            title=title,
            description=description,
            source_data={"reporter": reporter, "manual_report": True}
        )
        
        context = classification.context_used
        
        # Use provided severity if high confidence, otherwise use AI
        severity = initial_severity
        if not severity or classification.confidence > 0.7:
            severity = IncidentSeverity(context.get("severity", "medium"))
        
        incident = Incident(
            title=title,
            description=description,
            severity=severity,
            category=IncidentCategory(context.get("category", "unknown")),
            status=IncidentStatus.DETECTED,
            source_system="manual",
            affected_services=affected_services or context.get("affected_systems", []),
            metadata={
                "reporter": reporter,
                "ai_confidence": classification.confidence,
                "ai_reasoning": classification.reasoning
            }
        )
        
        return incident
    
    def quick_classify(
        self,
        title: str,
        description: str
    ) -> tuple[IncidentSeverity, IncidentCategory]:
        """
        Quick rule-based classification without AI.
        
        Useful for initial triage before AI analysis completes.
        """
        text = f"{title} {description}".lower()
        
        # Determine severity
        severity = IncidentSeverity.MEDIUM  # Default
        for sev, keywords in self.SEVERITY_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                severity = sev
                break
        
        # Determine category
        category = IncidentCategory.UNKNOWN  # Default
        max_matches = 0
        for cat, keywords in self.CATEGORY_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in text)
            if matches > max_matches:
                max_matches = matches
                category = cat
        
        return severity, category
    
    async def enrich_incident(
        self,
        incident: Incident,
        additional_data: Dict[str, Any]
    ) -> Incident:
        """
        Enrich an existing incident with additional data.
        
        Args:
            incident: Existing incident
            additional_data: New data to incorporate
        """
        # Update affected services if new ones found
        if "services" in additional_data:
            new_services = set(additional_data["services"]) - set(incident.affected_services)
            incident.affected_services.extend(list(new_services))
        
        # Update components
        if "components" in additional_data:
            new_components = set(additional_data["components"]) - set(incident.affected_components)
            incident.affected_components.extend(list(new_components))
        
        # Add tags
        if "tags" in additional_data:
            new_tags = set(additional_data["tags"]) - set(incident.tags)
            incident.tags.extend(list(new_tags))
        
        # Store additional metadata
        incident.metadata.update(additional_data.get("metadata", {}))
        
        return incident
    
    def _extract_alert_info(
        self,
        alert_data: Dict[str, Any],
        source: str
    ) -> tuple[str, str]:
        """Extract title and description from alert data based on source."""
        
        # Common field mappings for different monitoring tools
        field_mappings = {
            "datadog": {
                "title": ["title", "name", "alert_title"],
                "description": ["message", "body", "description"]
            },
            "pagerduty": {
                "title": ["incident.title", "title", "summary"],
                "description": ["incident.description", "description", "details"]
            },
            "prometheus": {
                "title": ["labels.alertname", "alertname"],
                "description": ["annotations.description", "annotations.summary"]
            },
            "default": {
                "title": ["title", "name", "subject", "summary"],
                "description": ["description", "message", "body", "details"]
            }
        }
        
        mapping = field_mappings.get(source, field_mappings["default"])
        
        title = self._extract_field(alert_data, mapping["title"]) or "Unknown Alert"
        description = self._extract_field(alert_data, mapping["description"]) or ""
        
        return title, description
    
    def _extract_field(
        self,
        data: Dict[str, Any],
        field_paths: List[str]
    ) -> Optional[str]:
        """Extract a field value from nested dict using multiple possible paths."""
        for path in field_paths:
            value = data
            for key in path.split("."):
                if isinstance(value, dict) and key in value:
                    value = value[key]
                else:
                    value = None
                    break
            if value and isinstance(value, str):
                return value
        return None
    
    def _extract_tags(self, alert_data: Dict[str, Any]) -> List[str]:
        """Extract tags from alert data."""
        tags = []
        
        # Check common tag fields
        for field in ["tags", "labels", "attributes"]:
            if field in alert_data:
                field_data = alert_data[field]
                if isinstance(field_data, list):
                    tags.extend(str(t) for t in field_data)
                elif isinstance(field_data, dict):
                    tags.extend(f"{k}:{v}" for k, v in field_data.items())
        
        return tags


# Singleton instance
_agent: Optional[IncidentAgent] = None


def get_incident_agent() -> IncidentAgent:
    """Get the incident agent singleton."""
    global _agent
    if _agent is None:
        _agent = IncidentAgent()
    return _agent
