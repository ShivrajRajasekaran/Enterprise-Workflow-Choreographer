"""
Configuration management for the Enterprise Workflow Choreographer.
"""

import os
from typing import Optional
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class WatsonxConfig(BaseModel):
    """IBM watsonx AI configuration."""
    api_key: str = Field(default_factory=lambda: os.getenv("WATSONX_API_KEY", ""))
    project_id: str = Field(default_factory=lambda: os.getenv("WATSONX_PROJECT_ID", ""))
    url: str = Field(default_factory=lambda: os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com"))


class ServiceNowConfig(BaseModel):
    """ServiceNow configuration."""
    instance: str = Field(default_factory=lambda: os.getenv("SERVICENOW_INSTANCE", ""))
    username: str = Field(default_factory=lambda: os.getenv("SERVICENOW_USERNAME", ""))
    password: str = Field(default_factory=lambda: os.getenv("SERVICENOW_PASSWORD", ""))
    
    @property
    def base_url(self) -> str:
        return f"https://{self.instance}"


class GitHubConfig(BaseModel):
    """GitHub configuration."""
    token: str = Field(default_factory=lambda: os.getenv("GITHUB_TOKEN", ""))
    org: str = Field(default_factory=lambda: os.getenv("GITHUB_ORG", ""))


class SlackConfig(BaseModel):
    """Slack configuration."""
    bot_token: str = Field(default_factory=lambda: os.getenv("SLACK_BOT_TOKEN", ""))
    signing_secret: str = Field(default_factory=lambda: os.getenv("SLACK_SIGNING_SECRET", ""))
    app_token: str = Field(default_factory=lambda: os.getenv("SLACK_APP_TOKEN", ""))


class ConfluenceConfig(BaseModel):
    """Confluence configuration."""
    url: str = Field(default_factory=lambda: os.getenv("CONFLUENCE_URL", ""))
    username: str = Field(default_factory=lambda: os.getenv("CONFLUENCE_USERNAME", ""))
    api_token: str = Field(default_factory=lambda: os.getenv("CONFLUENCE_API_TOKEN", ""))
    space_key: str = Field(default_factory=lambda: os.getenv("CONFLUENCE_SPACE_KEY", "INCIDENTS"))


class JiraConfig(BaseModel):
    """Jira configuration."""
    url: str = Field(default_factory=lambda: os.getenv("JIRA_URL", ""))
    username: str = Field(default_factory=lambda: os.getenv("JIRA_USERNAME", ""))
    api_token: str = Field(default_factory=lambda: os.getenv("JIRA_API_TOKEN", ""))
    project_key: str = Field(default_factory=lambda: os.getenv("JIRA_PROJECT_KEY", "INC"))


class FeatureFlags(BaseModel):
    """Feature flags for enabling/disabling capabilities."""
    auto_ticketing: bool = Field(default_factory=lambda: os.getenv("ENABLE_AUTO_TICKETING", "true").lower() == "true")
    slack_notifications: bool = Field(default_factory=lambda: os.getenv("ENABLE_SLACK_NOTIFICATIONS", "true").lower() == "true")
    confluence_docs: bool = Field(default_factory=lambda: os.getenv("ENABLE_CONFLUENCE_DOCS", "true").lower() == "true")
    github_analysis: bool = Field(default_factory=lambda: os.getenv("ENABLE_GITHUB_ANALYSIS", "true").lower() == "true")


class AppConfig(BaseSettings):
    """Main application configuration."""
    env: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    port: int = Field(default_factory=lambda: int(os.getenv("APP_PORT", "8000")))
    log_level: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    
    # Sub-configurations
    watsonx: WatsonxConfig = Field(default_factory=WatsonxConfig)
    servicenow: ServiceNowConfig = Field(default_factory=ServiceNowConfig)
    github: GitHubConfig = Field(default_factory=GitHubConfig)
    slack: SlackConfig = Field(default_factory=SlackConfig)
    confluence: ConfluenceConfig = Field(default_factory=ConfluenceConfig)
    jira: JiraConfig = Field(default_factory=JiraConfig)
    features: FeatureFlags = Field(default_factory=FeatureFlags)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global configuration instance
config = AppConfig()


def get_config() -> AppConfig:
    """Get the global configuration instance."""
    return config
