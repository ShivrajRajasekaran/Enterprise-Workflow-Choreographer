"""
Tests for the Workflow Choreographer.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from src.models import (
    Incident, IncidentSeverity, IncidentCategory, IncidentStatus,
    WorkflowStep, Workflow, TeamMember
)
from src.workflows.choreographer import WorkflowChoreographer


class TestWorkflowChoreographer:
    """Test suite for WorkflowChoreographer."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.choreographer = WorkflowChoreographer()
    
    def test_get_available_tools(self):
        """Test getting available tools."""
        tools = self.choreographer._get_available_tools()
        
        assert "ai" in tools  # AI is always available
        assert isinstance(tools, list)
    
    def test_select_relevant_team_members_on_call_priority(self):
        """Test that on-call members are prioritized."""
        incident = Incident(
            title="Test",
            description="Test incident",
            severity=IncidentSeverity.HIGH,
            category=IncidentCategory.DATABASE
        )
        
        members = [
            TeamMember(
                id="1",
                name="Alice",
                email="alice@test.com",
                on_call=True,
                skills=["python"]
            ),
            TeamMember(
                id="2",
                name="Bob",
                email="bob@test.com",
                on_call=False,
                skills=["postgresql", "dba"]
            ),
        ]
        
        selected = self.choreographer._select_relevant_team_members(
            incident, members
        )
        
        # Alice should be first (on-call)
        assert selected[0].name == "Alice"
    
    def test_select_relevant_team_members_skill_matching(self):
        """Test that members with relevant skills are selected."""
        incident = Incident(
            title="Test",
            description="Test incident",
            severity=IncidentSeverity.MEDIUM,
            category=IncidentCategory.DATABASE
        )
        
        members = [
            TeamMember(
                id="1",
                name="Alice",
                email="alice@test.com",
                on_call=False,
                skills=["frontend", "react"]
            ),
            TeamMember(
                id="2",
                name="Bob",
                email="bob@test.com",
                on_call=False,
                skills=["postgresql", "sql"]
            ),
        ]
        
        selected = self.choreographer._select_relevant_team_members(
            incident, members
        )
        
        # Bob should be included due to database skills
        assert any(m.name == "Bob" for m in selected)
    
    def test_is_critical_step(self):
        """Test identifying critical steps."""
        critical_step = WorkflowStep(
            name="Create Ticket",
            action="create_ticket",
            target_tool="servicenow"
        )
        
        non_critical_step = WorkflowStep(
            name="Post Update",
            action="post_update",
            target_tool="slack"
        )
        
        assert self.choreographer._is_critical_step(critical_step) is True
        assert self.choreographer._is_critical_step(non_critical_step) is False
    
    def test_update_incident_from_result(self):
        """Test that incident is updated with step results."""
        incident = Incident(
            title="Test",
            description="Test incident",
            severity=IncidentSeverity.HIGH
        )
        
        step = WorkflowStep(
            name="Create Ticket",
            action="create_ticket",
            target_tool="servicenow"
        )
        
        from src.models import ActionResult
        result = ActionResult(
            success=True,
            action="create_ticket",
            tool="servicenow",
            message="Created",
            data={"number": "INC0012345"}
        )
        
        self.choreographer._update_incident_from_result(incident, step, result)
        
        assert incident.servicenow_ticket_id == "INC0012345"


class TestWorkflowModel:
    """Test suite for Workflow model."""
    
    def test_workflow_creation(self):
        """Test basic workflow creation."""
        workflow = Workflow(
            incident_id="test-incident-123",
            name="Test Workflow",
            description="A test workflow"
        )
        
        assert workflow.id is not None
        assert workflow.incident_id == "test-incident-123"
        assert workflow.status == "pending"
        assert len(workflow.steps) == 0
    
    def test_workflow_with_steps(self):
        """Test workflow with steps."""
        steps = [
            WorkflowStep(
                name="Step 1",
                action="create_ticket",
                target_tool="servicenow"
            ),
            WorkflowStep(
                name="Step 2",
                action="create_channel",
                target_tool="slack"
            )
        ]
        
        workflow = Workflow(
            incident_id="test-123",
            name="Test Workflow",
            description="Test",
            steps=steps
        )
        
        assert len(workflow.steps) == 2
        assert workflow.steps[0].name == "Step 1"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
