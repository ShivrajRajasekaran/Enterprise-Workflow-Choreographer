"""
ServiceNow connector for incident management.
"""

import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime
import structlog

from ..config import get_config, ServiceNowConfig
from ..models import Incident, IncidentSeverity

logger = structlog.get_logger()


class ServiceNowConnector:
    """
    Connector for ServiceNow incident management.
    
    Provides functionality to:
    - Create incidents
    - Update incident status
    - Add comments/work notes
    - Query incidents
    - Assign incidents to teams/users
    """
    
    SEVERITY_MAP = {
        IncidentSeverity.CRITICAL: 1,
        IncidentSeverity.HIGH: 2,
        IncidentSeverity.MEDIUM: 3,
        IncidentSeverity.LOW: 4,
    }
    
    URGENCY_MAP = {
        IncidentSeverity.CRITICAL: 1,
        IncidentSeverity.HIGH: 2,
        IncidentSeverity.MEDIUM: 2,
        IncidentSeverity.LOW: 3,
    }
    
    def __init__(self, config: Optional[ServiceNowConfig] = None):
        self.config = config or get_config().servicenow
        self.base_url = self.config.base_url
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                auth=(self.config.username, self.config.password),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                timeout=30.0
            )
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def create_incident(self, incident: Incident) -> Dict[str, Any]:
        """
        Create a new incident in ServiceNow.
        
        Args:
            incident: The incident to create
            
        Returns:
            ServiceNow incident details including sys_id and number
        """
        client = await self._get_client()
        
        payload = {
            "short_description": incident.title,
            "description": self._build_description(incident),
            "impact": self.SEVERITY_MAP.get(incident.severity, 3),
            "urgency": self.URGENCY_MAP.get(incident.severity, 2),
            "category": incident.category.value,
            "subcategory": "",
            "contact_type": "monitoring",  # Auto-detected
            "caller_id": "",  # System account
            "assignment_group": self._get_assignment_group(incident),
            "u_affected_services": ", ".join(incident.affected_services),
            "u_external_reference": incident.id,
        }
        
        logger.info("Creating ServiceNow incident", incident_id=incident.id)
        
        try:
            response = await client.post(
                "/api/now/table/incident",
                json=payload
            )
            response.raise_for_status()
            result = response.json().get("result", {})
            
            logger.info(
                "ServiceNow incident created",
                incident_id=incident.id,
                snow_number=result.get("number"),
                snow_sys_id=result.get("sys_id")
            )
            
            return {
                "success": True,
                "sys_id": result.get("sys_id"),
                "number": result.get("number"),
                "link": f"{self.base_url}/nav_to.do?uri=incident.do?sys_id={result.get('sys_id')}"
            }
            
        except httpx.HTTPError as e:
            logger.error("Failed to create ServiceNow incident", error=str(e))
            return {
                "success": False,
                "error": str(e)
            }
    
    async def update_incident(
        self,
        sys_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update an existing incident.
        
        Args:
            sys_id: ServiceNow sys_id of the incident
            updates: Fields to update
            
        Returns:
            Updated incident details
        """
        client = await self._get_client()
        
        try:
            response = await client.patch(
                f"/api/now/table/incident/{sys_id}",
                json=updates
            )
            response.raise_for_status()
            result = response.json().get("result", {})
            
            logger.info("ServiceNow incident updated", sys_id=sys_id)
            return {"success": True, "result": result}
            
        except httpx.HTTPError as e:
            logger.error("Failed to update ServiceNow incident", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def add_work_note(self, sys_id: str, note: str) -> Dict[str, Any]:
        """Add a work note to an incident."""
        return await self.update_incident(sys_id, {"work_notes": note})
    
    async def add_comment(self, sys_id: str, comment: str) -> Dict[str, Any]:
        """Add a customer-visible comment to an incident."""
        return await self.update_incident(sys_id, {"comments": comment})
    
    async def resolve_incident(
        self,
        sys_id: str,
        resolution_code: str,
        resolution_notes: str
    ) -> Dict[str, Any]:
        """
        Resolve an incident.
        
        Args:
            sys_id: ServiceNow sys_id
            resolution_code: Resolution code (e.g., "Solved (Permanently)")
            resolution_notes: Description of the resolution
        """
        return await self.update_incident(sys_id, {
            "state": 6,  # Resolved
            "close_code": resolution_code,
            "close_notes": resolution_notes
        })
    
    async def get_incident(self, sys_id: str) -> Optional[Dict[str, Any]]:
        """Get incident details by sys_id."""
        client = await self._get_client()
        
        try:
            response = await client.get(f"/api/now/table/incident/{sys_id}")
            response.raise_for_status()
            return response.json().get("result")
        except httpx.HTTPError as e:
            logger.error("Failed to get ServiceNow incident", error=str(e))
            return None
    
    async def search_incidents(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for incidents.
        
        Args:
            query: ServiceNow encoded query string
            limit: Maximum results to return
        """
        client = await self._get_client()
        
        try:
            response = await client.get(
                "/api/now/table/incident",
                params={
                    "sysparm_query": query,
                    "sysparm_limit": limit
                }
            )
            response.raise_for_status()
            return response.json().get("result", [])
        except httpx.HTTPError as e:
            logger.error("Failed to search ServiceNow incidents", error=str(e))
            return []
    
    def _build_description(self, incident: Incident) -> str:
        """Build a detailed description for ServiceNow."""
        parts = [
            incident.description,
            "",
            "--- Auto-generated by Workflow Choreographer ---",
            f"Internal ID: {incident.id}",
            f"Source: {incident.source_system}",
            f"Detected at: {incident.detected_at.isoformat()}",
        ]
        
        if incident.affected_services:
            parts.append(f"Affected Services: {', '.join(incident.affected_services)}")
        
        if incident.affected_components:
            parts.append(f"Affected Components: {', '.join(incident.affected_components)}")
        
        if incident.tags:
            parts.append(f"Tags: {', '.join(incident.tags)}")
        
        return "\n".join(parts)
    
    def _get_assignment_group(self, incident: Incident) -> str:
        """
        Determine the assignment group based on incident category.
        
        In production, this would map to actual ServiceNow group sys_ids.
        """
        group_map = {
            "infrastructure": "Platform Engineering",
            "database": "Database Administration",
            "security": "Security Operations",
            "network": "Network Operations",
            "application": "Application Support",
            "performance": "Performance Engineering",
        }
        return group_map.get(incident.category.value, "IT Support")


# Singleton instance
_connector: Optional[ServiceNowConnector] = None


def get_servicenow_connector() -> ServiceNowConnector:
    """Get the ServiceNow connector singleton."""
    global _connector
    if _connector is None:
        _connector = ServiceNowConnector()
    return _connector
