# 🤖 IBM Watson Orchestrate - Enterprise Workflow Choreographer

<div align="center">

![IBM Watson Orchestrate](https://img.shields.io/badge/IBM-Watson%20Orchestrate-054ADA?style=for-the-badge&logo=ibm&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

**An agentic AI solution that dynamically coordinates incident response workflows across enterprise tools**

</div>

---

## 🎯 Problem Statement

Modern enterprises use multiple tools (ServiceNow, Slack, GitHub, Confluence, Jira) for incident management. When an incident occurs, teams must manually:

1. Create tickets in ServiceNow
2. Alert team members via Slack
3. Gather diagnostic information from GitHub
4. Analyze root causes
5. Document findings in Confluence
6. Create and assign Jira issues
7. Monitor resolution progress

**This solution automates ALL of these steps using IBM watsonx.ai powered Agentic AI.**

## 🚀 Key Features

### 1. **Autonomous Incident Detection**
- Monitors multiple data sources (APIs, webhooks, logs)
- Uses AI to classify incident severity and type
- Triggers appropriate workflow automatically

### 2. **Dynamic Workflow Choreography**
- No pre-defined rigid workflows
- AI determines optimal sequence of actions
- Adapts based on incident context and available resources

### 3. **Multi-Tool Integration**
- **ServiceNow**: Auto-create/update incidents, assign priorities
- **GitHub**: Create issues, analyze recent commits, gather logs
- **Slack**: Assemble response teams, create incident channels, send updates
- **Confluence**: Generate post-mortem templates, document findings

### 4. **Intelligent Analysis**
- Automatic log correlation and analysis
- AI-generated root-cause hypotheses
- Smart recommendations for resolution

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE WORKFLOW CHOREOGRAPHER                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Incident   │───▶│   AI Orchestrator │───▶│    Workflow      │  │
│  │   Detector   │    │   (watsonx/LLM)   │    │   Choreographer  │  │
│  └──────────────┘    └──────────────────┘    └──────────────────┘  │
│         │                     │                       │             │
│         ▼                     ▼                       ▼             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    TOOL INTEGRATION LAYER                    │   │
│  ├─────────────┬─────────────┬─────────────┬──────────────────┤   │
│  │  ServiceNow │   GitHub    │    Slack    │    Confluence    │   │
│  │  Connector  │  Connector  │  Connector  │    Connector     │   │
│  └─────────────┴─────────────┴─────────────┴──────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 📦 Installation

```bash
# Clone the repository
git clone <repo-url>
cd WatsonxOrchestrate-Hackathon

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env with your API keys
```

## ⚙️ Configuration

Set up your environment variables in `.env`:

```env
# IBM watsonx
WATSONX_API_KEY=your_api_key
WATSONX_PROJECT_ID=your_project_id

# ServiceNow
SERVICENOW_INSTANCE=your_instance.service-now.com
SERVICENOW_USERNAME=your_username
SERVICENOW_PASSWORD=your_password

# GitHub
GITHUB_TOKEN=your_github_token

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your_signing_secret

# Confluence
CONFLUENCE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your_email
CONFLUENCE_API_TOKEN=your_api_token
```

## 🎮 Usage

### Start the Orchestrator

```bash
python -m src.main
```

### Trigger a Test Incident

```bash
python -m src.simulate_incident --type critical --service payment-api
```

### API Endpoints

```
POST /api/incident          - Report new incident
GET  /api/incident/{id}     - Get incident status
GET  /api/workflows         - List active workflows
POST /api/webhook/alert     - Webhook for monitoring tools
```

## 🔄 Example Workflow

When a critical incident is detected:

1. **🔍 Detection** → AI analyzes incoming alert
2. **🎫 Ticketing** → Auto-creates ServiceNow incident with proper priority
3. **👥 Team Assembly** → Creates Slack channel, invites relevant engineers
4. **📊 Data Gathering** → Pulls logs from GitHub, APM tools
5. **🧠 Analysis** → AI generates root-cause hypothesis
6. **📝 Documentation** → Creates Confluence post-mortem template
7. **📢 Communication** → Updates stakeholders via Slack

## 🧪 Demo Scenarios

### Scenario 1: Database Connection Failure
- Detects DB timeout errors in logs
- Creates P1 incident in ServiceNow
- Assembles DBA team in Slack
- Gathers recent DB-related commits from GitHub
- Suggests rollback if recent changes detected

### Scenario 2: API Performance Degradation
- Detects latency spike from monitoring webhook
- Creates P2 incident with performance tag
- Notifies platform team
- Pulls relevant Grafana dashboards
- Drafts performance analysis report

## 📁 Project Structure

```
├── src/
│   ├── main.py                 # Application entry point
│   ├── config.py               # Configuration management
│   ├── agents/
│   │   ├── orchestrator.py     # Main AI orchestrator
│   │   ├── incident_agent.py   # Incident detection & classification
│   │   └── analysis_agent.py   # Root cause analysis
│   ├── connectors/
│   │   ├── servicenow.py       # ServiceNow integration
│   │   ├── github_connector.py # GitHub integration
│   │   ├── slack_connector.py  # Slack integration
│   │   └── confluence.py       # Confluence integration
│   ├── workflows/
│   │   ├── choreographer.py    # Dynamic workflow engine
│   │   └── templates.py        # Workflow templates
│   └── api/
│       └── routes.py           # REST API endpoints
├── tests/
├── docs/
├── requirements.txt
└── .env.example
```

## 🤝 Contributing

This project was created for the IBM watsonx Orchestrate Hackathon.

## 📄 License

MIT License
