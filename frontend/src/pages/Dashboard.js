import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  LinearProgress,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useIncidents } from '../context/IncidentContext';
import { useSocket } from '../context/SocketContext';
import WorkflowProgress from '../components/WorkflowProgress';

const severityConfig = {
  critical: { color: '#da1e28', bgColor: '#fff1f1', icon: <ErrorIcon /> },
  high: { color: '#ff832b', bgColor: '#fff5ec', icon: <WarningIcon /> },
  medium: { color: '#f1c21b', bgColor: '#fffaeb', icon: <InfoIcon /> },
  low: { color: '#198038', bgColor: '#f0fff0', icon: <CheckCircleIcon /> },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { incidents, fetchIncidents, loading } = useIncidents();
  const { workflowUpdates } = useSocket();
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    resolved: 0,
    activeWorkflows: 0,
  });

  useEffect(() => {
    fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Calculate stats from incidents
    const newStats = {
      total: incidents.length,
      critical: incidents.filter(i => i.severity === 'critical').length,
      high: incidents.filter(i => i.severity === 'high').length,
      medium: incidents.filter(i => i.severity === 'medium').length,
      low: incidents.filter(i => i.severity === 'low').length,
      resolved: incidents.filter(i => i.status === 'resolved').length,
      activeWorkflows: incidents.filter(i => i.status === 'in_progress').length,
    };
    setStats(newStats);
  }, [incidents]);

  const activeWorkflow = workflowUpdates.length > 0 
    ? workflowUpdates[workflowUpdates.length - 1] 
    : null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            IBM Watson Orchestrate - Incident Command Center
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchIncidents()}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/incidents?new=true')}
          >
            New Incident
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Total Incidents
                  </Typography>
                  <Typography variant="h3" fontWeight={600}>
                    {stats.total}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                  label="+12%"
                  sx={{ bgcolor: '#e5f6ff', color: '#0072c3' }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {stats.activeWorkflows} active workflows
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', borderLeft: `4px solid ${severityConfig.critical.color}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Critical
                  </Typography>
                  <Typography variant="h3" fontWeight={600} color="error">
                    {stats.critical}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: severityConfig.critical.bgColor, color: severityConfig.critical.color }}>
                  {severityConfig.critical.icon}
                </Avatar>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Requires immediate attention
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', borderLeft: `4px solid ${severityConfig.high.color}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    High Priority
                  </Typography>
                  <Typography variant="h3" fontWeight={600} sx={{ color: severityConfig.high.color }}>
                    {stats.high}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: severityConfig.high.bgColor, color: severityConfig.high.color }}>
                  {severityConfig.high.icon}
                </Avatar>
              </Box>
              <Typography variant="caption" color="text.secondary">
                High severity incidents
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', borderLeft: `4px solid ${severityConfig.low.color}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Resolved
                  </Typography>
                  <Typography variant="h3" fontWeight={600} color="success.main">
                    {stats.resolved}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  icon={<TrendingDownIcon sx={{ fontSize: 14 }} />}
                  label="MTTR: 2.5h"
                  sx={{ bgcolor: '#f0fff0', color: '#198038' }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Successfully resolved
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Active Workflow */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Active Workflow
            </Typography>
            {activeWorkflow ? (
              <WorkflowProgress workflow={activeWorkflow} />
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No active workflows. Create an incident to start orchestration.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                color="error"
                fullWidth
                onClick={() => navigate('/incidents?new=true&severity=critical')}
              >
                🚨 Report Critical Incident
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/incidents')}
              >
                📋 View All Incidents
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/workflows')}
              >
                🔄 View Workflows
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/settings')}
              >
                ⚙️ Configure Integrations
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Recent Incidents */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Recent Incidents
              </Typography>
              <Button size="small" onClick={() => navigate('/incidents')}>
                View All
              </Button>
            </Box>
            <List>
              {incidents.slice(0, 5).map((incident, index) => (
                <React.Fragment key={incident.id || incident._id || index}>
                  <ListItem
                    secondaryAction={
                      <Chip
                        size="small"
                        label={incident.status}
                        color={incident.status === 'resolved' ? 'success' : 'default'}
                      />
                    }
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/incidents/${incident.id || incident._id}`)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ 
                        bgcolor: severityConfig[incident.severity]?.bgColor,
                        color: severityConfig[incident.severity]?.color 
                      }}>
                        {severityConfig[incident.severity]?.icon}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={incident.title}
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.secondary">
                            {incident.category || 'General'} • {new Date(incident.createdAt || incident.detectedAt).toLocaleString()}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                  {index < Math.min(incidents.length, 5) - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
              {incidents.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No incidents found"
                    secondary="Create your first incident to start the orchestration workflow"
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
