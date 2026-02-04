"""
Slack connector for team communication and incident coordination.
"""

import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
import structlog
from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError

from ..config import get_config, SlackConfig
from ..models import Incident, IncidentSeverity, TeamMember

logger = structlog.get_logger()


class SlackConnector:
    """
    Connector for Slack communication.
    
    Provides functionality to:
    - Create incident channels
    - Notify teams and individuals
    - Post incident updates
    - Assemble response teams
    - Send rich message blocks
    """
    
    SEVERITY_EMOJI = {
        IncidentSeverity.CRITICAL: "🔴",
        IncidentSeverity.HIGH: "🟠",
        IncidentSeverity.MEDIUM: "🟡",
        IncidentSeverity.LOW: "🟢",
    }
    
    def __init__(self, config: Optional[SlackConfig] = None):
        self.config = config or get_config().slack
        self._client: Optional[AsyncWebClient] = None
    
    @property
    def client(self) -> AsyncWebClient:
        """Get or create Slack client."""
        if self._client is None:
            self._client = AsyncWebClient(token=self.config.bot_token)
        return self._client
    
    async def create_incident_channel(
        self,
        incident: Incident
    ) -> Dict[str, Any]:
        """
        Create a dedicated Slack channel for incident response.
        
        Args:
            incident: The incident to create a channel for
            
        Returns:
            Channel details including id and name
        """
        # Generate channel name
        timestamp = incident.detected_at.strftime("%Y%m%d")
        severity_prefix = incident.severity.value[:4]
        safe_title = "".join(c if c.isalnum() else "-" for c in incident.title.lower())[:30]
        channel_name = f"inc-{severity_prefix}-{timestamp}-{safe_title}"
        
        logger.info("Creating incident channel", channel_name=channel_name)
        
        try:
            # Create the channel
            response = await self.client.conversations_create(
                name=channel_name,
                is_private=False  # Set to True for sensitive incidents
            )
            
            channel_id = response["channel"]["id"]
            
            # Set channel topic
            topic = f"🚨 {incident.severity.value.upper()} Incident: {incident.title}"
            await self.client.conversations_setTopic(
                channel=channel_id,
                topic=topic[:250]  # Slack topic limit
            )
            
            # Set channel purpose
            purpose = f"Incident response channel. ID: {incident.id}"
            await self.client.conversations_setPurpose(
                channel=channel_id,
                purpose=purpose
            )
            
            # Post initial incident details
            await self._post_incident_summary(channel_id, incident)
            
            logger.info(
                "Incident channel created",
                channel_id=channel_id,
                channel_name=channel_name
            )
            
            return {
                "success": True,
                "channel_id": channel_id,
                "channel_name": channel_name,
                "link": f"https://slack.com/app_redirect?channel={channel_id}"
            }
            
        except SlackApiError as e:
            logger.error("Failed to create incident channel", error=str(e))
            return {
                "success": False,
                "error": str(e)
            }
    
    async def invite_users_to_channel(
        self,
        channel_id: str,
        user_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Invite users to an incident channel.
        
        Args:
            channel_id: Slack channel ID
            user_ids: List of Slack user IDs to invite
        """
        try:
            await self.client.conversations_invite(
                channel=channel_id,
                users=",".join(user_ids)
            )
            
            logger.info(
                "Users invited to channel",
                channel_id=channel_id,
                user_count=len(user_ids)
            )
            return {"success": True, "invited_count": len(user_ids)}
            
        except SlackApiError as e:
            logger.error("Failed to invite users", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def notify_team(
        self,
        channel: str,
        message: str,
        incident: Optional[Incident] = None,
        mention_users: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send a notification to a channel.
        
        Args:
            channel: Channel ID or name
            message: Message text
            incident: Optional incident for rich formatting
            mention_users: List of user IDs to mention
        """
        try:
            # Build message with mentions
            if mention_users:
                mentions = " ".join(f"<@{uid}>" for uid in mention_users)
                message = f"{mentions}\n\n{message}"
            
            # Build blocks for rich message
            blocks = self._build_notification_blocks(message, incident)
            
            response = await self.client.chat_postMessage(
                channel=channel,
                text=message,
                blocks=blocks,
                unfurl_links=False
            )
            
            return {
                "success": True,
                "ts": response["ts"],
                "channel": response["channel"]
            }
            
        except SlackApiError as e:
            logger.error("Failed to send notification", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def send_direct_message(
        self,
        user_id: str,
        message: str,
        incident: Optional[Incident] = None
    ) -> Dict[str, Any]:
        """Send a direct message to a user."""
        try:
            # Open DM channel
            dm_response = await self.client.conversations_open(users=[user_id])
            channel_id = dm_response["channel"]["id"]
            
            return await self.notify_team(
                channel=channel_id,
                message=message,
                incident=incident
            )
            
        except SlackApiError as e:
            logger.error("Failed to send DM", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def post_incident_update(
        self,
        channel_id: str,
        incident: Incident,
        update_type: str,
        details: str
    ) -> Dict[str, Any]:
        """
        Post an incident status update.
        
        Args:
            channel_id: Channel to post to
            incident: The incident
            update_type: Type of update (e.g., "status_change", "team_assigned")
            details: Update details
        """
        emoji_map = {
            "status_change": "📊",
            "team_assigned": "👥",
            "analysis_complete": "🔍",
            "mitigation_started": "🛠️",
            "resolved": "✅",
            "escalation": "⬆️",
        }
        
        emoji = emoji_map.get(update_type, "📝")
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{emoji} *Incident Update*\n{details}"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Status: *{incident.status.value}* | Updated: {datetime.utcnow().strftime('%H:%M UTC')}"
                    }
                ]
            }
        ]
        
        try:
            response = await self.client.chat_postMessage(
                channel=channel_id,
                text=f"Incident Update: {details}",
                blocks=blocks
            )
            return {"success": True, "ts": response["ts"]}
        except SlackApiError as e:
            logger.error("Failed to post update", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def assemble_response_team(
        self,
        incident: Incident,
        team_members: List[TeamMember],
        channel_id: str
    ) -> Dict[str, Any]:
        """
        Assemble a virtual response team for an incident.
        
        Args:
            incident: The incident
            team_members: List of team members to assemble
            channel_id: Incident channel ID
        """
        # Filter members with Slack IDs
        slack_members = [m for m in team_members if m.slack_user_id]
        
        if not slack_members:
            return {"success": False, "error": "No team members with Slack IDs"}
        
        # Invite all to channel
        user_ids = [m.slack_user_id for m in slack_members]
        await self.invite_users_to_channel(channel_id, user_ids)
        
        # Build team roster message
        roster_lines = ["*🚨 Incident Response Team Assembled*\n"]
        for member in slack_members:
            skills = ", ".join(member.skills[:3]) if member.skills else "General"
            roster_lines.append(f"• <@{member.slack_user_id}> - {skills}")
        
        roster_lines.append(f"\n_Please acknowledge your participation with a 👍 reaction._")
        
        await self.notify_team(
            channel=channel_id,
            message="\n".join(roster_lines)
        )
        
        # Send DM to each member
        for member in slack_members:
            await self.send_direct_message(
                user_id=member.slack_user_id,
                message=f"You've been added to incident response team for: *{incident.title}*\n\nPlease join <#{channel_id}> immediately.",
                incident=incident
            )
        
        return {
            "success": True,
            "assembled_count": len(slack_members),
            "channel_id": channel_id
        }
    
    async def _post_incident_summary(
        self,
        channel_id: str,
        incident: Incident
    ) -> None:
        """Post initial incident summary to channel."""
        emoji = self.SEVERITY_EMOJI.get(incident.severity, "⚪")
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} {incident.severity.value.upper()} INCIDENT",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{incident.title}*\n\n{incident.description}"
                }
            },
            {"type": "divider"},
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Category:*\n{incident.category.value}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Status:*\n{incident.status.value}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Detected:*\n{incident.detected_at.strftime('%Y-%m-%d %H:%M UTC')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*ID:*\n`{incident.id[:8]}...`"
                    }
                ]
            }
        ]
        
        if incident.affected_services:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Affected Services:* {', '.join(incident.affected_services)}"
                }
            })
        
        if incident.servicenow_ticket_id:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"📋 *ServiceNow Ticket:* {incident.servicenow_ticket_id}"
                }
            })
        
        await self.client.chat_postMessage(
            channel=channel_id,
            text=f"Incident: {incident.title}",
            blocks=blocks
        )
    
    def _build_notification_blocks(
        self,
        message: str,
        incident: Optional[Incident] = None
    ) -> List[Dict[str, Any]]:
        """Build Slack blocks for notifications."""
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": message
                }
            }
        ]
        
        if incident:
            emoji = self.SEVERITY_EMOJI.get(incident.severity, "⚪")
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"{emoji} {incident.severity.value.upper()} | {incident.category.value} | ID: {incident.id[:8]}"
                    }
                ]
            })
        
        return blocks


# Singleton instance
_connector: Optional[SlackConnector] = None


def get_slack_connector() -> SlackConnector:
    """Get the Slack connector singleton."""
    global _connector
    if _connector is None:
        _connector = SlackConnector()
    return _connector
