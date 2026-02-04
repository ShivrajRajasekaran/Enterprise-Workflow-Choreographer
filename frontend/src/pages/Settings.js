import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';

const integrations = [
  {
    id: 'servicenow',
    name: 'ServiceNow',
    icon: '🎫',
    description: 'Incident ticket management',
    fields: ['instance', 'username', 'password'],
    envVars: ['SERVICENOW_INSTANCE', 'SERVICENOW_USERNAME', 'SERVICENOW_PASSWORD'],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Team notifications and alerts',
    fields: ['botToken', 'appToken', 'channel'],
    envVars: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_INCIDENT_CHANNEL'],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '📊',
    description: 'Code diagnostics and repository info',
    fields: ['token', 'org', 'repo'],
    envVars: ['GITHUB_TOKEN', 'GITHUB_ORG', 'GITHUB_REPO'],
  },
  {
    id: 'watsonx',
    name: 'IBM watsonx.ai',
    icon: '🤖',
    description: 'AI-powered root cause analysis',
    fields: ['apiKey', 'projectId', 'region'],
    envVars: ['WATSONX_API_KEY', 'WATSONX_PROJECT_ID', 'WATSONX_REGION'],
  },
  {
    id: 'confluence',
    name: 'Confluence',
    icon: '📄',
    description: 'Incident documentation',
    fields: ['url', 'email', 'apiToken', 'space'],
    envVars: ['CONFLUENCE_URL', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN', 'CONFLUENCE_SPACE'],
  },
  {
    id: 'jira',
    name: 'Jira',
    icon: '📋',
    description: 'Issue tracking and assignment',
    fields: ['url', 'email', 'apiToken', 'project'],
    envVars: ['JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT'],
  },
];

const Settings = () => {
  const [settings, setSettings] = useState({
    autoTriggerWorkflow: true,
    notifyOnCritical: true,
    notifyOnHigh: true,
    notifyOnMedium: false,
    notifyOnLow: false,
    aiAnalysisEnabled: true,
    createConfluencePage: true,
    createJiraIssue: true,
  });

  const [connectionStatus, setConnectionStatus] = useState({
    servicenow: 'connected',
    slack: 'connected',
    github: 'connected',
    watsonx: 'connected',
    confluence: 'connected',
    jira: 'connected',
  });

  const handleSettingChange = (setting) => (event) => {
    setSettings({ ...settings, [setting]: event.target.checked });
  };

  const handleSaveSettings = () => {
    toast.success('Settings saved successfully');
  };

  const testConnection = (integrationId) => {
    toast.info(`Testing ${integrationId} connection...`);
    // Simulate connection test
    setTimeout(() => {
      setConnectionStatus(prev => ({ ...prev, [integrationId]: 'connected' }));
      toast.success(`${integrationId} connection successful`);
    }, 1500);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure integrations and workflow behavior
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Workflow Settings */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Workflow Configuration
            </Typography>
            <Divider sx={{ my: 2 }} />

            <List>
              <ListItem>
                <ListItemText
                  primary="Auto-trigger Workflow"
                  secondary="Automatically start workflow when incident is created"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.autoTriggerWorkflow}
                    onChange={handleSettingChange('autoTriggerWorkflow')}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="AI Analysis"
                  secondary="Use IBM watsonx.ai for root cause analysis"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.aiAnalysisEnabled}
                    onChange={handleSettingChange('aiAnalysisEnabled')}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Create Confluence Page"
                  secondary="Automatically document incidents in Confluence"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.createConfluencePage}
                    onChange={handleSettingChange('createConfluencePage')}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Create Jira Issue"
                  secondary="Automatically create Jira issues for incidents"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.createJiraIssue}
                    onChange={handleSettingChange('createJiraIssue')}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Notification Settings
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Send Slack alerts for:
            </Typography>

            <List dense>
              <ListItem>
                <ListItemText primary="Critical incidents" />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notifyOnCritical}
                    onChange={handleSettingChange('notifyOnCritical')}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText primary="High severity incidents" />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notifyOnHigh}
                    onChange={handleSettingChange('notifyOnHigh')}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText primary="Medium severity incidents" />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notifyOnMedium}
                    onChange={handleSettingChange('notifyOnMedium')}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText primary="Low severity incidents" />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notifyOnLow}
                    onChange={handleSettingChange('notifyOnLow')}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveSettings}
              >
                Save Settings
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Integrations */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Integrations
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Configure connections to external services
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Alert severity="info" sx={{ mb: 3 }}>
              Integration credentials are configured via environment variables in the backend.
              The status below shows the current connection state.
            </Alert>

            <Grid container spacing={2}>
              {integrations.map((integration) => (
                <Grid item xs={12} sm={6} md={4} key={integration.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h5">{integration.icon}</Typography>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {integration.name}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          icon={connectionStatus[integration.id] === 'connected' ? 
                            <CheckCircleIcon sx={{ fontSize: 16 }} /> : 
                            <ErrorIcon sx={{ fontSize: 16 }} />
                          }
                          label={connectionStatus[integration.id] === 'connected' ? 'Connected' : 'Disconnected'}
                          color={connectionStatus[integration.id] === 'connected' ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {integration.description}
                      </Typography>

                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        Environment Variables:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                        {integration.envVars.map((envVar) => (
                          <Chip
                            key={envVar}
                            size="small"
                            label={envVar}
                            sx={{ fontSize: 10 }}
                          />
                        ))}
                      </Box>

                      <Button
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={() => testConnection(integration.id)}
                      >
                        Test Connection
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* About Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              About
            </Typography>
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h4">🤖</Typography>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  IBM Watson Orchestrate
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Multi-tool Enterprise Workflow Choreographer
                </Typography>
              </Box>
            </Box>

            <Typography variant="body2" paragraph>
              This solution automates incident response by coordinating workflows across multiple
              enterprise tools including ServiceNow, Slack, GitHub, Confluence, and Jira.
            </Typography>

            <Typography variant="body2" paragraph>
              Powered by IBM watsonx.ai for intelligent root cause analysis and automated decision making.
            </Typography>

            <Typography variant="caption" color="text.secondary">
              Version 1.0.0 | Built for IBM Watson Orchestrate Hackathon
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
