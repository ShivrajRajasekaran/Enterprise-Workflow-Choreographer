# Quick Start Guide

## Prerequisites
- Python 3.11+
- API credentials for the tools you want to integrate

## 1. Setup

```bash
# Navigate to project
cd WatsonxOrchestrate-Hackathon

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
docker-compose up -d
# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
copy .env.example .env
```

## 2. Configure

Edit `.env` with your credentials:

```env
# IBM watsonx (Required for AI features)
WATSONX_API_KEY=your_api_key
WATSONX_PROJECT_ID=your_project_id

# ServiceNow (Optional - for ticketing)
SERVICENOW_INSTANCE=your_instance.service-now.com
SERVICENOW_USERNAME=your_username
SERVICENOW_PASSWORD=your_password

# GitHub (Optional - for code analysis)
GITHUB_TOKEN=ghp_your_token

# Slack (Optional - for notifications)
SLACK_BOT_TOKEN=xoxb-your-token

# Confluence (Optional - for documentation)
CONFLUENCE_URL=https://your-domain.atlassian.net/wiki
CONFLUENCE_USERNAME=your_email
CONFLUENCE_API_TOKEN=your_token
```

## 3. Run

```bash
# Start the server
python -m src.main
```

The server will start at http://localhost:8000

## 4. Test

### View API Documentation
Open http://localhost:8000/docs in your browser

### Simulate an Incident
```bash
# List available scenarios
python -m src.simulate_incident --list

# Run a specific scenario
python -m src.simulate_incident --scenario database_outage

# Run full demo
python -m src.simulate_incident --demo
```

### Manual API Test
```bash
curl -X POST http://localhost:8000/api/incident \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Incident",
    "description": "This is a test incident for demonstration",
    "reporter": "demo_user",
    "severity": "high"
  }'
```

## 5. Verify

Check that the workflow executed:
1. **ServiceNow**: New incident ticket created
2. **Slack**: Incident channel created (if configured)
3. **Confluence**: Post-mortem template created (if configured)

## Troubleshooting

### "Connection refused" error
- Make sure the server is running (`python -m src.main`)
- Check the port (default: 8000)

### "Authentication failed" for integrations
- Verify your API credentials in `.env`
- Check that the service URLs are correct

### AI features not working
- Ensure `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` are set
- Verify your watsonx account has access to Granite models

## Running Tests

```bash
pytest tests/ -v
```
