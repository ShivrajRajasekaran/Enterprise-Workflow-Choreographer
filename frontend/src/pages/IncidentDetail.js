import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Link,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import { useIncidents } from '../context/IncidentContext';
import { useSocket } from '../context/SocketContext';
import WorkflowProgress from '../components/WorkflowProgress';

const severityColors = {
  critical: { bg: '#fff1f1', color: '#da1e28', label: 'Critical' },
  high: { bg: '#fff5ec', color: '#ff832b', label: 'High' },
  medium: { bg: '#fffaeb', color: '#f1c21b', label: 'Medium' },
  low: { bg: '#f0fff0', color: '#198038', label: 'Low' },
};

const IncidentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentIncident, fetchIncident, triggerWorkflow, loading } = useIncidents();
  const { workflowUpdates } = useSocket();
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (id) {
      fetchIncident(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleTriggerWorkflow = async () => {
    if (id) {
      await triggerWorkflow(id);
    }
  };

  // Auto-refresh incident data when workflow updates occur
  useEffect(() => {
    if (workflowUpdates.length > 0 && id) {
      const lastUpdate = workflowUpdates[workflowUpdates.length - 1];
      if (lastUpdate.incidentId === id || (currentIncident && lastUpdate.incidentId === currentIncident.id)) {
        // Debounce the fetch to prevent rapid re-renders
        const timer = setTimeout(() => fetchIncident(id), 500);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowUpdates.length, id]);

  // Get workflow for this incident
  const incidentWorkflow = workflowUpdates.find(w => w.incidentId === id);

  if (loading && !currentIncident) {
    return (
      <Box>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading incident details...</Typography>
      </Box>
    );
  }

  if (!currentIncident) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          Incident not found
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/incidents')}
          sx={{ mt: 2 }}
        >
          Back to Incidents
        </Button>
      </Box>
    );
  }

  const incident = currentIncident;
  const severity = severityColors[incident.severity] || severityColors.medium;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/incidents')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight={600}>
              {incident.title}
            </Typography>
            <Chip
              size="small"
              label={severity.label}
              sx={{ bgcolor: severity.bg, color: severity.color, fontWeight: 500 }}
            />
            <Chip
              size="small"
              label={incident.status?.replace('_', ' ')}
              variant="outlined"
              sx={{ textTransform: 'capitalize' }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            ID: {incident.id || incident._id}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={handleTriggerWorkflow}
          disabled={loading}
        >
          {incident.status === 'detected' ? 'Start Workflow' : 'Re-run Workflow'}
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={(e, v) => setTabValue(v)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Overview" />
              <Tab label="Workflow" />
              <Tab label="Analysis" />
              <Tab label="Timeline" />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {tabValue === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3 }}>
                    {incident.description}
                  </Typography>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="h6" gutterBottom>
                    Affected Services
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {(incident.affectedServices || []).map((service) => (
                      <Chip key={service} label={service} variant="outlined" />
                    ))}
                    {(!incident.affectedServices || incident.affectedServices.length === 0) && (
                      <Typography color="text.secondary">No services specified</Typography>
                    )}
                  </Box>

                  {incident.aiAnalysis && (
                    <>
                      <Divider sx={{ my: 3 }} />
                      <Typography variant="h6" gutterBottom>
                        AI Analysis Summary
                      </Typography>
                      <Card variant="outlined" sx={{ bgcolor: '#f4f4f4' }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            Root Cause (IBM watsonx.ai)
                          </Typography>
                          <Typography variant="body2">
                            {incident.aiAnalysis.rootCause}
                          </Typography>
                          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                            <Chip
                              size="small"
                              label={`Confidence: ${incident.aiAnalysis.confidence || 'Medium'}`}
                              color="info"
                            />
                            <Chip
                              size="small"
                              label={`ETA: ${incident.aiAnalysis.estimatedTimeToResolve || 'TBD'}`}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </Box>
              )}

              {tabValue === 1 && (
                <WorkflowProgress workflow={incidentWorkflow || incident.workflow} />
              )}

              {tabValue === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Root Cause Analysis
                  </Typography>
                  {incident.aiAnalysis ? (
                    <>
                      <Card variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            Root Cause
                          </Typography>
                          <Typography variant="body2">
                            {incident.aiAnalysis.rootCause}
                          </Typography>
                        </CardContent>
                      </Card>

                      <Typography variant="subtitle2" gutterBottom>
                        Contributing Factors
                      </Typography>
                      <List dense>
                        {(incident.aiAnalysis.contributingFactors || []).map((factor, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <ErrorIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={factor} />
                          </ListItem>
                        ))}
                      </List>

                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                        Recommended Actions
                      </Typography>
                      <List dense>
                        {(incident.aiAnalysis.immediateActions || []).map((action, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckCircleIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={action} />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  ) : (
                    <Typography color="text.secondary">
                      AI analysis not yet available. Trigger the workflow to generate analysis.
                    </Typography>
                  )}
                </Box>
              )}

              {tabValue === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Incident Timeline
                  </Typography>
                  <List>
                    {(incident.timeline || []).map((event, idx) => (
                      <ListItem key={idx}>
                        <ListItemIcon>
                          <ScheduleIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={event.action}
                          secondary={new Date(event.timestamp).toLocaleString()}
                        />
                      </ListItem>
                    ))}
                    <ListItem>
                      <ListItemIcon>
                        <ScheduleIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Incident detected"
                        secondary={new Date(incident.detectedAt || incident.createdAt).toLocaleString()}
                      />
                    </ListItem>
                  </List>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Details Card */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Details
              </Typography>
              <List dense>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Category"
                    secondary={incident.category || 'Not specified'}
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Detected At"
                    secondary={new Date(incident.detectedAt || incident.createdAt).toLocaleString()}
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="Last Updated"
                    secondary={new Date(incident.updatedAt || incident.createdAt).toLocaleString()}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Assignment Card */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Assignment
              </Typography>
              {incident.assignment ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <PersonIcon color="action" />
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {incident.assignment.assignee?.name || 'Unassigned'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {incident.assignment.team || 'No team'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Not yet assigned
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* External Links Card */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                External Links
              </Typography>
              <Typography variant="caption" color="primary" sx={{ mb: 1, display: 'block' }}>
                Click to verify in enterprise tools
              </Typography>
              <List dense>
                {incident.servicenowTicketId && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <LinkIcon fontSize="small" color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Link
                          href={incident.servicenowTicketUrl || `https://dev223831.service-now.com/incident.do?sys_id=${incident.servicenowTicketId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                        >
                          ServiceNow: {incident.servicenowTicketId}
                        </Link>
                      }
                      secondary="Click to view in ServiceNow"
                    />
                  </ListItem>
                )}
                {incident.jiraIssueKey && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <LinkIcon fontSize="small" color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Link
                          href={incident.jiraIssueUrl || `https://shivrajr.atlassian.net/jira/core/projects/ZQFG/board?selectedIssue=${incident.jiraIssueKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                        >
                          Jira: {incident.jiraIssueKey}
                        </Link>
                      }
                      secondary="Click to view in Jira"
                    />
                  </ListItem>
                )}
                {incident.confluencePageId && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <LinkIcon fontSize="small" color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Link
                          href={incident.confluencePageUrl || `https://shivrajr.atlassian.net/wiki/spaces/Hackathon/pages/${incident.confluencePageId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                        >
                          Confluence Page
                        </Link>
                      }
                      secondary="Click to view documentation"
                    />
                  </ListItem>
                )}
                {incident.githubIssueUrl && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <LinkIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Link
                          href={incident.githubIssueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                        >
                          GitHub Issue: #{incident.githubIssueNumber}
                        </Link>
                      }
                      secondary="Click to view in GitHub"
                    />
                  </ListItem>
                )}
                {incident.slackChannelId && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <LinkIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Link
                          href={`https://slack.com/app_redirect?channel=${incident.slackChannelId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                        >
                          Slack: {incident.slackChannelName || '#incident-response'}
                        </Link>
                      }
                      secondary="Click to open Slack channel"
                    />
                  </ListItem>
                )}
                {!incident.servicenowTicketId && !incident.jiraIssueKey && !incident.slackChannelId && (
                  <Typography variant="body2" color="text.secondary">
                    No external links yet. Trigger workflow to create.
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default IncidentDetail;
