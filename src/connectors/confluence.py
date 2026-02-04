"""
Confluence connector for documentation and post-mortem management.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import structlog
from atlassian import Confluence

from ..config import get_config, ConfluenceConfig
from ..models import Incident, IncidentSeverity

logger = structlog.get_logger()


class ConfluenceConnector:
    """
    Connector for Confluence documentation.
    
    Provides functionality to:
    - Create post-mortem templates
    - Document incident timelines
    - Generate runbooks
    - Update knowledge base articles
    """
    
    def __init__(self, config: Optional[ConfluenceConfig] = None):
        self.config = config or get_config().confluence
        self._client: Optional[Confluence] = None
    
    @property
    def client(self) -> Confluence:
        """Get or create Confluence client."""
        if self._client is None:
            self._client = Confluence(
                url=self.config.url,
                username=self.config.username,
                password=self.config.api_token,
                cloud=True
            )
        return self._client
    
    async def create_postmortem(
        self,
        incident: Incident,
        parent_page_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a post-mortem document for an incident.
        
        Args:
            incident: The incident to create a post-mortem for
            parent_page_id: Optional parent page ID
            
        Returns:
            Page details including ID and URL
        """
        # Generate page title
        date_str = incident.detected_at.strftime("%Y-%m-%d")
        title = f"Post-Mortem: {date_str} - {incident.title}"
        
        # Build page content
        content = self._build_postmortem_template(incident)
        
        logger.info("Creating post-mortem page", incident_id=incident.id, title=title)
        
        try:
            result = self.client.create_page(
                space=self.config.space_key,
                title=title,
                body=content,
                parent_id=parent_page_id,
                type="page"
            )
            
            page_id = result.get("id")
            page_url = f"{self.config.url}/spaces/{self.config.space_key}/pages/{page_id}"
            
            logger.info(
                "Post-mortem page created",
                incident_id=incident.id,
                page_id=page_id
            )
            
            return {
                "success": True,
                "page_id": page_id,
                "page_url": page_url,
                "title": title
            }
            
        except Exception as e:
            logger.error("Failed to create post-mortem", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def update_page(
        self,
        page_id: str,
        content: str,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update an existing Confluence page."""
        try:
            # Get current page to get version
            page = self.client.get_page_by_id(page_id)
            
            self.client.update_page(
                page_id=page_id,
                title=title or page.get("title"),
                body=content
            )
            
            return {"success": True, "page_id": page_id}
            
        except Exception as e:
            logger.error("Failed to update page", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def add_incident_timeline_entry(
        self,
        page_id: str,
        timestamp: datetime,
        event: str,
        details: str
    ) -> Dict[str, Any]:
        """
        Add an entry to an incident's timeline.
        
        Args:
            page_id: The post-mortem page ID
            timestamp: When the event occurred
            event: Event type/name
            details: Event details
        """
        try:
            # Get current page content
            page = self.client.get_page_by_id(page_id, expand="body.storage")
            current_content = page.get("body", {}).get("storage", {}).get("value", "")
            
            # Build timeline entry
            entry_html = f"""
            <tr>
                <td>{timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")}</td>
                <td><strong>{event}</strong></td>
                <td>{details}</td>
            </tr>
            """
            
            # Insert into timeline table (look for marker)
            marker = "<!-- TIMELINE_ENTRIES -->"
            if marker in current_content:
                updated_content = current_content.replace(
                    marker,
                    f"{entry_html}\n{marker}"
                )
            else:
                # Append to end if marker not found
                updated_content = current_content + entry_html
            
            return await self.update_page(page_id, updated_content)
            
        except Exception as e:
            logger.error("Failed to add timeline entry", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def create_runbook(
        self,
        title: str,
        incident_type: str,
        steps: List[str],
        parent_page_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create or update a runbook based on incident learnings.
        
        Args:
            title: Runbook title
            incident_type: Type of incident this runbook addresses
            steps: List of resolution steps
            parent_page_id: Optional parent page ID
        """
        content = self._build_runbook_template(title, incident_type, steps)
        
        try:
            # Check if runbook already exists
            existing = self.client.get_page_by_title(
                space=self.config.space_key,
                title=title
            )
            
            if existing:
                return await self.update_page(existing["id"], content, title)
            
            result = self.client.create_page(
                space=self.config.space_key,
                title=title,
                body=content,
                parent_id=parent_page_id,
                type="page"
            )
            
            return {
                "success": True,
                "page_id": result.get("id"),
                "page_url": f"{self.config.url}/spaces/{self.config.space_key}/pages/{result.get('id')}"
            }
            
        except Exception as e:
            logger.error("Failed to create runbook", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def search_knowledge_base(
        self,
        query: str,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Search the knowledge base for relevant articles.
        
        Args:
            query: Search query
            limit: Maximum results
        """
        try:
            results = self.client.cql(
                f'space = "{self.config.space_key}" AND text ~ "{query}"',
                limit=limit
            )
            
            pages = []
            for result in results.get("results", []):
                pages.append({
                    "id": result.get("content", {}).get("id"),
                    "title": result.get("content", {}).get("title"),
                    "url": result.get("content", {}).get("_links", {}).get("webui"),
                    "excerpt": result.get("excerpt", "")
                })
            
            return {
                "success": True,
                "results": pages,
                "total": results.get("totalSize", 0)
            }
            
        except Exception as e:
            logger.error("Failed to search knowledge base", error=str(e))
            return {"success": False, "error": str(e)}
    
    def _build_postmortem_template(self, incident: Incident) -> str:
        """Build a post-mortem document template."""
        severity_color = {
            IncidentSeverity.CRITICAL: "#FF0000",
            IncidentSeverity.HIGH: "#FF6600",
            IncidentSeverity.MEDIUM: "#FFCC00",
            IncidentSeverity.LOW: "#00CC00",
        }.get(incident.severity, "#808080")
        
        affected_services_html = "".join(
            f"<li>{svc}</li>" for svc in incident.affected_services
        ) if incident.affected_services else "<li>To be determined</li>"
        
        resolution_steps_html = "".join(
            f"<li>{step}</li>" for step in incident.resolution_steps
        ) if incident.resolution_steps else "<li>To be documented</li>"
        
        return f"""
<ac:structured-macro ac:name="info">
    <ac:rich-text-body>
        <p><strong>This document was auto-generated by the Enterprise Workflow Choreographer.</strong></p>
        <p>Please complete all sections marked with [TODO].</p>
    </ac:rich-text-body>
</ac:structured-macro>

<h1>Incident Summary</h1>

<table>
    <tr>
        <th>Field</th>
        <th>Value</th>
    </tr>
    <tr>
        <td>Incident ID</td>
        <td><code>{incident.id}</code></td>
    </tr>
    <tr>
        <td>Severity</td>
        <td><span style="color: {severity_color}; font-weight: bold;">{incident.severity.value.upper()}</span></td>
    </tr>
    <tr>
        <td>Category</td>
        <td>{incident.category.value}</td>
    </tr>
    <tr>
        <td>Status</td>
        <td>{incident.status.value}</td>
    </tr>
    <tr>
        <td>Detected</td>
        <td>{incident.detected_at.strftime("%Y-%m-%d %H:%M:%S UTC")}</td>
    </tr>
    <tr>
        <td>ServiceNow Ticket</td>
        <td>{incident.servicenow_ticket_id or "[TODO: Add ticket number]"}</td>
    </tr>
</table>

<h2>Description</h2>
<p>{incident.description}</p>

<h2>Affected Services</h2>
<ul>
{affected_services_html}
</ul>

<h2>Timeline</h2>
<table>
    <tr>
        <th>Time (UTC)</th>
        <th>Event</th>
        <th>Details</th>
    </tr>
    <tr>
        <td>{incident.detected_at.strftime("%Y-%m-%d %H:%M:%S")}</td>
        <td>Incident Detected</td>
        <td>Automated detection triggered</td>
    </tr>
    <!-- TIMELINE_ENTRIES -->
</table>

<h2>Root Cause Analysis</h2>

<h3>AI-Generated Hypothesis</h3>
<ac:structured-macro ac:name="note">
    <ac:rich-text-body>
        <p>{incident.root_cause_hypothesis or "[AI analysis pending or not available]"}</p>
    </ac:rich-text-body>
</ac:structured-macro>

<h3>Confirmed Root Cause</h3>
<p>[TODO: Document the confirmed root cause after investigation]</p>

<h2>Resolution Steps</h2>
<ol>
{resolution_steps_html}
</ol>

<h2>Impact Assessment</h2>
<table>
    <tr>
        <th>Metric</th>
        <th>Value</th>
    </tr>
    <tr>
        <td>Duration</td>
        <td>[TODO: Calculate total duration]</td>
    </tr>
    <tr>
        <td>Customers Affected</td>
        <td>[TODO: Add number]</td>
    </tr>
    <tr>
        <td>Revenue Impact</td>
        <td>[TODO: Calculate if applicable]</td>
    </tr>
    <tr>
        <td>SLA Impact</td>
        <td>[TODO: Document SLA breaches]</td>
    </tr>
</table>

<h2>Action Items</h2>
<table>
    <tr>
        <th>Action</th>
        <th>Owner</th>
        <th>Due Date</th>
        <th>Status</th>
    </tr>
    <tr>
        <td>[TODO: Add preventive action]</td>
        <td>[TODO: Assign owner]</td>
        <td>[TODO: Set date]</td>
        <td>Open</td>
    </tr>
</table>

<h2>Lessons Learned</h2>
<h3>What Went Well</h3>
<ul>
    <li>[TODO: Document positive aspects]</li>
</ul>

<h3>What Could Be Improved</h3>
<ul>
    <li>[TODO: Document improvement areas]</li>
</ul>

<hr/>
<p><em>Last updated: {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}</em></p>
"""
    
    def _build_runbook_template(
        self,
        title: str,
        incident_type: str,
        steps: List[str]
    ) -> str:
        """Build a runbook template."""
        steps_html = "".join(
            f"<li>{step}</li>" for step in steps
        )
        
        return f"""
<ac:structured-macro ac:name="info">
    <ac:rich-text-body>
        <p><strong>Runbook:</strong> {title}</p>
        <p><strong>Incident Type:</strong> {incident_type}</p>
    </ac:rich-text-body>
</ac:structured-macro>

<h2>Overview</h2>
<p>This runbook provides step-by-step instructions for handling {incident_type} incidents.</p>

<h2>Prerequisites</h2>
<ul>
    <li>Access to relevant systems and tools</li>
    <li>Required permissions and credentials</li>
    <li>Communication channels established</li>
</ul>

<h2>Resolution Steps</h2>
<ol>
{steps_html}
</ol>

<h2>Verification</h2>
<p>[TODO: Add steps to verify the issue is resolved]</p>

<h2>Escalation</h2>
<p>If the above steps do not resolve the issue, escalate to the appropriate team.</p>

<hr/>
<p><em>Auto-generated from incident learnings. Last updated: {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}</em></p>
"""


# Singleton instance
_connector: Optional[ConfluenceConnector] = None


def get_confluence_connector() -> ConfluenceConnector:
    """Get the Confluence connector singleton."""
    global _connector
    if _connector is None:
        _connector = ConfluenceConnector()
    return _connector
