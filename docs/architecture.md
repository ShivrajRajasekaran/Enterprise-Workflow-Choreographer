# Enterprise Workflow Choreographer - Architecture

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                    EXTERNAL TRIGGERS                         │
                                    │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
                                    │  │  Datadog  │ │ PagerDuty │ │Prometheus │ │  Manual   │   │
                                    │  │  Alerts   │ │  Alerts   │ │  Alerts   │ │  Reports  │   │
                                    │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘   │
                                    └────────┼─────────────┼─────────────┼─────────────┼─────────┘
                                             │             │             │             │
                                             └──────────┬──┴─────────────┴─────┬───────┘
                                                        │                       │
                                                        ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              ENTERPRISE WORKFLOW CHOREOGRAPHER                                      │
│                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                    API GATEWAY (FastAPI)                                     │  │
│  │                                                                                              │  │
│  │   POST /api/webhook/alert    POST /api/incident    GET /api/workflows    GET /api/health   │  │
│  └──────────────────────────────────────────┬──────────────────────────────────────────────────┘  │
│                                              │                                                     │
│                                              ▼                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                    AGENT LAYER                                             │   │
│  │                                                                                            │   │
│  │  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐            │   │
│  │  │   INCIDENT AGENT     │  │    AI ORCHESTRATOR   │  │   ANALYSIS AGENT     │            │   │
│  │  │                      │  │                      │  │                      │            │   │
│  │  │  • Alert Processing  │  │  • IBM watsonx AI    │  │  • Log Correlation   │            │   │
│  │  │  • Classification    │  │  • Decision Making   │  │  • Change Analysis   │            │   │
│  │  │  • Triage            │  │  • Workflow Planning │  │  • Root Cause        │            │   │
│  │  │  • Enrichment        │  │  • Team Assignment   │  │  • Recommendations   │            │   │
│  │  └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘            │   │
│  │             │                          │                         │                        │   │
│  └─────────────┼──────────────────────────┼─────────────────────────┼────────────────────────┘   │
│                │                          │                         │                            │
│                └──────────────────────────┼─────────────────────────┘                            │
│                                           │                                                       │
│                                           ▼                                                       │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              WORKFLOW CHOREOGRAPHER ENGINE                                 │   │
│  │                                                                                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │  Dynamic Step   │  │   Parallel &    │  │  Error Handling │  │   Real-time     │      │   │
│  │  │   Generation    │  │   Sequential    │  │   & Retry       │  │   Adaptation    │      │   │
│  │  │                 │  │   Execution     │  │                 │  │                 │      │   │
│  │  │  AI recommends  │  │  Independent    │  │  Graceful       │  │  Adapts based   │      │   │
│  │  │  steps based    │  │  steps run in   │  │  degradation    │  │  on step        │      │   │
│  │  │  on context     │  │  parallel       │  │  continues      │  │  results        │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  │                                                                                            │   │
│  └───────────────────────────────────────────┬───────────────────────────────────────────────┘   │
│                                               │                                                   │
│                                               ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              TOOL INTEGRATION LAYER                                        │   │
│  │                                                                                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │   ServiceNow    │  │     GitHub      │  │      Slack      │  │   Confluence    │      │   │
│  │  │   Connector     │  │   Connector     │  │   Connector     │  │   Connector     │      │   │
│  │  │                 │  │                 │  │                 │  │                 │      │   │
│  │  │  • Create INC   │  │  • Analyze      │  │  • Create       │  │  • Create       │      │   │
│  │  │  • Update       │  │    Commits      │  │    Channels     │  │    Post-Mortem  │      │   │
│  │  │  • Add Notes    │  │  • Create       │  │  • Notify       │  │  • Update       │      │   │
│  │  │  • Resolve      │  │    Issues       │  │    Teams        │  │    Runbooks     │      │   │
│  │  │                 │  │  • Search       │  │  • Assemble     │  │  • Search KB    │      │   │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │   │
│  │           │                    │                    │                    │               │   │
│  └───────────┼────────────────────┼────────────────────┼────────────────────┼───────────────┘   │
│              │                    │                    │                    │                    │
└──────────────┼────────────────────┼────────────────────┼────────────────────┼────────────────────┘
               │                    │                    │                    │
               ▼                    ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     ENTERPRISE SYSTEMS                                            │
│                                                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   ServiceNow    │  │     GitHub      │  │      Slack      │  │   Confluence    │             │
│  │                 │  │                 │  │                 │  │                 │             │
│  │   ITSM Platform │  │  Source Control │  │  Communication  │  │   Knowledge     │             │
│  │                 │  │  & CI/CD        │  │  & Collaboration│  │   Management    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘


                              ╔════════════════════════════════════════╗
                              ║         DATA FLOW SEQUENCE             ║
                              ╠════════════════════════════════════════╣
                              ║  1. Alert received from monitoring     ║
                              ║  2. Incident Agent classifies alert    ║
                              ║  3. AI Orchestrator plans workflow     ║
                              ║  4. Choreographer executes steps:      ║
                              ║     a. Create ServiceNow ticket        ║
                              ║     b. Create Slack channel            ║
                              ║     c. Assemble response team          ║
                              ║     d. Analyze recent changes          ║
                              ║     e. Generate root cause hypothesis  ║
                              ║     f. Create post-mortem template     ║
                              ║  5. Updates posted to all channels     ║
                              ╚════════════════════════════════════════╝
```

## Component Details

### 1. API Gateway
- **Technology**: FastAPI
- **Purpose**: Receives webhooks from monitoring tools, manual reports
- **Endpoints**: Alert webhooks, incident management, workflow status

### 2. Incident Agent
- **Purpose**: Process and classify incoming incidents
- **Capabilities**: 
  - Parse alerts from multiple sources (Datadog, PagerDuty, Prometheus)
  - AI-assisted severity classification
  - Category detection (database, network, security, etc.)
  - Incident enrichment

### 3. AI Orchestrator (IBM watsonx)
- **Model**: IBM Granite foundation models
- **Capabilities**:
  - Incident classification and severity assessment
  - Root cause hypothesis generation
  - Workflow step recommendation
  - Team assignment optimization
  - Communication summarization

### 4. Analysis Agent
- **Purpose**: Deep incident analysis
- **Capabilities**:
  - Log pattern detection
  - Code change correlation
  - Similar incident search
  - Resolution recommendations

### 5. Workflow Choreographer
- **Purpose**: Dynamic workflow execution
- **Key Features**:
  - No pre-defined rigid workflows
  - AI-driven step generation
  - Parallel execution where possible
  - Graceful error handling
  - Real-time adaptation

### 6. Tool Connectors
- **ServiceNow**: Incident creation, updates, resolution
- **GitHub**: Commit analysis, issue creation, deployment checks
- **Slack**: Channel creation, team notification, updates
- **Confluence**: Post-mortem creation, runbook generation
