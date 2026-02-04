# API Keys & Credentials Required

This document lists all the API keys and credentials needed for the IBM Watson Orchestrate Hackathon solution.

---

## 🔑 Summary Table

| Service | Credentials Required | Where to Get |
|---------|---------------------|--------------|
| **IBM watsonx** | API Key + Project ID | IBM Cloud Console |
| **ServiceNow** | Instance URL + Username + Password | ServiceNow Admin Panel |
| **Slack** | Bot Token + Signing Secret | Slack API Portal |
| **GitHub** | Personal Access Token | GitHub Developer Settings |
| **Confluence** | URL + Email + API Token | Atlassian Account Settings |
| **Jira** | URL + Email + API Token | Atlassian Account Settings |

---

## 1. IBM watsonx AI (Required)

**What you need:**
- `WATSONX_API_KEY` - Your IBM Cloud API key
- `WATSONX_PROJECT_ID` - Your watsonx.ai project ID
- `WATSONX_URL` - API endpoint (default: `https://us-south.ml.cloud.ibm.com`)

**How to get:**
1. Go to [IBM Cloud Console](https://cloud.ibm.com)
2. Navigate to **Manage > Access (IAM) > API keys**
3. Click **Create an IBM Cloud API key**
4. For Project ID:
   - Go to [watsonx.ai](https://dataplatform.cloud.ibm.com/wx/)
   - Open your project
   - Click **Manage > General**
   - Copy the Project ID

---

## 2. ServiceNow (Required)

**What you need:**
- `SERVICENOW_INSTANCE` - Your instance URL (e.g., `dev12345.service-now.com`)
- `SERVICENOW_USERNAME` - ServiceNow user account
- `SERVICENOW_PASSWORD` - ServiceNow password

**How to get:**
1. Log into your ServiceNow instance
2. Go to **System Administrator > Users**
3. Create a dedicated service account for integration
4. Grant necessary roles: `itil`, `incident_manager`

**For Dev/Testing:**
- Get a free [ServiceNow Developer Instance](https://developer.servicenow.com)

---

## 3. Slack (Required)

**What you need:**
- `SLACK_BOT_TOKEN` - Bot User OAuth Token (starts with `xoxb-`)
- `SLACK_SIGNING_SECRET` - App Signing Secret (for webhook verification)

**How to get:**
1. Go to [Slack API](https://api.slack.com/apps)
2. Click **Create New App** > **From scratch**
3. Name it "Watson Orchestrate Bot" and select your workspace
4. Navigate to **OAuth & Permissions**
5. Add these Bot Token Scopes:
   - `channels:manage` - Create channels
   - `channels:join` - Join channels
   - `channels:read` - Read channel info
   - `chat:write` - Send messages
   - `users:read` - Read user info
   - `users:read.email` - Read user emails
6. Click **Install to Workspace**
7. Copy the **Bot User OAuth Token**
8. Go to **Basic Information** and copy the **Signing Secret**

---

## 4. GitHub (Required)

**What you need:**
- `GITHUB_TOKEN` - Personal Access Token
- `GITHUB_ORG` - Your organization name (optional)

**How to get:**
1. Go to [GitHub Settings > Developer Settings](https://github.com/settings/tokens)
2. Click **Personal access tokens > Tokens (classic)**
3. Click **Generate new token (classic)**
4. Select these scopes:
   - `repo` - Full control of repositories
   - `workflow` - Read/write workflows
   - `read:org` - Read organization data
5. Copy the generated token

---

## 5. Confluence (Required)

**What you need:**
- `CONFLUENCE_URL` - Your Confluence URL (e.g., `https://yoursite.atlassian.net`)
- `CONFLUENCE_EMAIL` - Your Atlassian account email
- `CONFLUENCE_API_TOKEN` - API token
- `CONFLUENCE_SPACE_KEY` - Space key for incident pages (e.g., `INCIDENTS`)

**How to get:**
1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage/api-tokens)
2. Click **Create API token**
3. Give it a name like "Watson Orchestrate"
4. Copy the token

---

## 6. Jira (Required)

**What you need:**
- `JIRA_URL` - Your Jira URL (e.g., `https://yoursite.atlassian.net`)
- `JIRA_USERNAME` - Your Atlassian account email
- `JIRA_API_TOKEN` - API token (same as Confluence if using Atlassian Cloud)
- `JIRA_PROJECT_KEY` - Project key for incident issues (e.g., `INC`)

**How to get:**
- Same API token as Confluence (Atlassian uses one token for all products)
- For Project Key: Go to your Jira project settings

---

## 📋 Complete .env File Template

```bash
# IBM watsonx AI Configuration
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# ServiceNow Configuration
SERVICENOW_INSTANCE=dev12345.service-now.com
SERVICENOW_USERNAME=admin
SERVICENOW_PASSWORD=your_password

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your_signing_secret

# GitHub Configuration
GITHUB_TOKEN=ghp_your_token_here
GITHUB_ORG=your-organization

# Confluence Configuration
CONFLUENCE_URL=https://yoursite.atlassian.net/wiki
CONFLUENCE_EMAIL=your.email@company.com
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_SPACE_KEY=INCIDENTS

# Jira Configuration
JIRA_URL=https://yoursite.atlassian.net
JIRA_USERNAME=your.email@company.com
JIRA_API_TOKEN=your_api_token
JIRA_PROJECT_KEY=INC
```

---

## 🧪 Testing Without Real Credentials

For hackathon demo/testing, you can use mock mode:

```bash
# Enable mock mode (no real API calls)
MOCK_MODE=true
```

This allows you to demonstrate the workflow without connecting to real services.

---

## 🔐 Security Notes

1. **Never commit credentials** to version control
2. Use `.env` file (already in `.gitignore`)
3. For production, use secret management (Azure Key Vault, AWS Secrets Manager)
4. Rotate API keys regularly
5. Use minimal required permissions

---

## 📞 Quick Links

| Service | Documentation |
|---------|--------------|
| IBM watsonx | [watsonx.ai Docs](https://dataplatform.cloud.ibm.com/docs/content/wsj/getting-started/welcome-main.html) |
| ServiceNow | [REST API Guide](https://developer.servicenow.com/dev.do#!/reference/api/tokyo/rest/) |
| Slack | [Slack API](https://api.slack.com/docs) |
| GitHub | [GitHub REST API](https://docs.github.com/en/rest) |
| Confluence | [Confluence Cloud REST API](https://developer.atlassian.com/cloud/confluence/rest/) |
| Jira | [Jira Cloud REST API](https://developer.atlassian.com/cloud/jira/platform/rest/) |
