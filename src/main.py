"""
Enterprise Workflow Choreographer - Main Application Entry Point.

This application provides an AI-powered, autonomous workflow orchestration
system that coordinates incident response across multiple enterprise tools
without human intervention.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog
import uvicorn

from .config import get_config
from .api import router


# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Enterprise Workflow Choreographer")
    config = get_config()
    logger.info(
        "Configuration loaded",
        env=config.env,
        features={
            "auto_ticketing": config.features.auto_ticketing,
            "slack_notifications": config.features.slack_notifications,
            "github_analysis": config.features.github_analysis,
            "confluence_docs": config.features.confluence_docs
        }
    )
    
    yield
    
    # Shutdown
    logger.info("Shutting down Enterprise Workflow Choreographer")


# Create FastAPI application
app = FastAPI(
    title="Enterprise Workflow Choreographer",
    description="""
    An AI-powered, autonomous workflow orchestration system that coordinates
    incident response across multiple enterprise tools (ServiceNow, GitHub, 
    Slack, Confluence) without human intervention.
    
    ## Features
    
    * **Autonomous Incident Detection** - Process alerts from monitoring tools
    * **Dynamic Workflow Orchestration** - AI-driven workflow decisions
    * **Multi-Tool Coordination** - Seamless integration across enterprise tools
    * **Intelligent Analysis** - AI-powered root cause hypothesis
    
    ## Example Workflow
    
    1. Alert received from monitoring tool
    2. AI classifies incident severity and category
    3. ServiceNow ticket auto-created
    4. Slack channel created, team assembled
    5. Recent code changes analyzed
    6. Root cause hypothesis generated
    7. Post-mortem template created
    """,
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint with application info."""
    return {
        "name": "Enterprise Workflow Choreographer",
        "version": "1.0.0",
        "description": "AI-powered multi-tool workflow orchestration",
        "docs": "/docs",
        "health": "/api/health"
    }


def main():
    """Main entry point."""
    config = get_config()
    
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=config.port,
        reload=config.env == "development",
        log_level=config.log_level.lower()
    )


if __name__ == "__main__":
    main()
