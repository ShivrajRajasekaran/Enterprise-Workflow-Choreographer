"""
Tests for the Incident Agent.
"""

import pytest
from datetime import datetime

from src.models import Incident, IncidentSeverity, IncidentCategory
from src.agents.incident_agent import IncidentAgent


class TestIncidentAgent:
    """Test suite for IncidentAgent."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.agent = IncidentAgent()
    
    def test_quick_classify_critical_severity(self):
        """Test classification of critical severity incidents."""
        severity, category = self.agent.quick_classify(
            title="Production Database Down",
            description="Critical outage affecting all users"
        )
        
        assert severity == IncidentSeverity.CRITICAL
    
    def test_quick_classify_database_category(self):
        """Test classification of database-related incidents."""
        severity, category = self.agent.quick_classify(
            title="PostgreSQL Connection Error",
            description="Database connection pool exhausted"
        )
        
        assert category == IncidentCategory.DATABASE
    
    def test_quick_classify_network_category(self):
        """Test classification of network-related incidents."""
        severity, category = self.agent.quick_classify(
            title="DNS Resolution Failure",
            description="Load balancer cannot reach backend services"
        )
        
        assert category == IncidentCategory.NETWORK
    
    def test_quick_classify_security_category(self):
        """Test classification of security-related incidents."""
        severity, category = self.agent.quick_classify(
            title="Unauthorized Access Attempt",
            description="Multiple failed authentication attempts detected"
        )
        
        assert category == IncidentCategory.SECURITY
    
    def test_quick_classify_unknown_defaults(self):
        """Test that unknown incidents get default values."""
        severity, category = self.agent.quick_classify(
            title="Something happened",
            description="Not sure what this is about"
        )
        
        assert severity == IncidentSeverity.MEDIUM
        assert category == IncidentCategory.UNKNOWN
    
    def test_extract_tags_from_list(self):
        """Test extracting tags from list format."""
        alert_data = {
            "tags": ["production", "critical", "database"]
        }
        
        tags = self.agent._extract_tags(alert_data)
        
        assert "production" in tags
        assert "critical" in tags
        assert "database" in tags
    
    def test_extract_tags_from_dict(self):
        """Test extracting tags from dict format."""
        alert_data = {
            "labels": {
                "environment": "production",
                "service": "api"
            }
        }
        
        tags = self.agent._extract_tags(alert_data)
        
        assert "environment:production" in tags
        assert "service:api" in tags


class TestIncidentModel:
    """Test suite for Incident model."""
    
    def test_incident_creation(self):
        """Test basic incident creation."""
        incident = Incident(
            title="Test Incident",
            description="This is a test",
            severity=IncidentSeverity.HIGH
        )
        
        assert incident.id is not None
        assert incident.title == "Test Incident"
        assert incident.severity == IncidentSeverity.HIGH
        assert incident.status.value == "detected"
    
    def test_incident_with_all_fields(self):
        """Test incident with all optional fields."""
        incident = Incident(
            title="Full Incident",
            description="Complete incident",
            severity=IncidentSeverity.CRITICAL,
            category=IncidentCategory.DATABASE,
            source_system="datadog",
            affected_services=["user-api", "payment-api"],
            tags=["production", "critical"]
        )
        
        assert incident.category == IncidentCategory.DATABASE
        assert "user-api" in incident.affected_services
        assert "production" in incident.tags


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
