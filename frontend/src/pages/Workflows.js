import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { workflowAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';

const stepIcons = {
  servicenow: '🎫',
  slack: '💬',
  github: '📊',
  watsonx: '🤖',
  confluence: '📄',
  jira: '📋',
  monitor: '👁️',
};

const Workflows = () => {
  const navigate = useNavigate();
  const { workflowUpdates } = useSocket();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update workflows when socket updates arrive - debounced
  useEffect(() => {
    if (workflowUpdates.length > 0) {
      const timer = setTimeout(() => fetchWorkflows(), 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowUpdates.length]);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const response = await workflowAPI.getAll();
      setWorkflows(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      // Use demo data
      setWorkflows(getDemoWorkflows());
    } finally {
      setLoading(false);
    }
  };

  const getDemoWorkflows = () => [
    {
      id: 'WF-001',
      incidentId: 'INC-2024-001',
      status: 'completed',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      steps: [
        { stepId: 'servicenow', status: 'completed', duration: 2500 },
        { stepId: 'slack', status: 'completed', duration: 1800 },
        { stepId: 'github', status: 'completed', duration: 3200 },
        { stepId: 'watsonx', status: 'completed', duration: 5600 },
        { stepId: 'confluence', status: 'completed', duration: 2100 },
        { stepId: 'jira', status: 'completed', duration: 1900 },
        { stepId: 'monitor', status: 'completed', duration: 500 },
      ],
    },
    {
      id: 'WF-002',
      incidentId: 'INC-2024-002',
      status: 'in_progress',
      startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      steps: [
        { stepId: 'servicenow', status: 'completed', duration: 2100 },
        { stepId: 'slack', status: 'completed', duration: 1500 },
        { stepId: 'github', status: 'completed', duration: 2800 },
        { stepId: 'watsonx', status: 'in_progress', duration: null },
        { stepId: 'confluence', status: 'pending' },
        { stepId: 'jira', status: 'pending' },
        { stepId: 'monitor', status: 'pending' },
      ],
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon color="success" />;
      case 'failed': return <ErrorIcon color="error" />;
      case 'in_progress': return <PlayArrowIcon color="info" />;
      default: return <PendingIcon color="disabled" />;
    }
  };

  const calculateProgress = (steps) => {
    if (!steps || steps.length === 0) return 0;
    const completed = steps.filter(s => s.status === 'completed').length;
    return (completed / steps.length) * 100;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Workflows
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor automated incident response workflows
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchWorkflows}
        >
          Refresh
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Active Workflows
              </Typography>
              <Typography variant="h3" fontWeight={600} color="info.main">
                {workflows.filter(w => w.status === 'in_progress').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Completed Today
              </Typography>
              <Typography variant="h3" fontWeight={600} color="success.main">
                {workflows.filter(w => w.status === 'completed').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Avg. Completion Time
              </Typography>
              <Typography variant="h3" fontWeight={600}>
                4.2m
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Workflows List */}
      <Grid container spacing={3}>
        {workflows.map((workflow) => (
          <Grid item xs={12} key={workflow.id || workflow._id}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" fontWeight={600}>
                      {workflow.id || workflow._id}
                    </Typography>
                    <Chip
                      size="small"
                      label={workflow.status?.replace('_', ' ')}
                      color={getStatusColor(workflow.status)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Incident: {workflow.incidentId} | Started: {new Date(workflow.startedAt).toLocaleString()}
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => navigate(`/incidents/${workflow.incidentId}`)}
                  title="View Incident"
                >
                  <ViewIcon />
                </IconButton>
              </Box>

              {/* Progress Bar */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Progress
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(calculateProgress(workflow.steps))}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={calculateProgress(workflow.steps)}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              {/* Steps */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(workflow.steps || []).map((step) => (
                  <Chip
                    key={step.stepId}
                    icon={getStatusIcon(step.status)}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{stepIcons[step.stepId] || '📋'}</span>
                        <span style={{ textTransform: 'capitalize' }}>{step.stepId}</span>
                        {step.duration && (
                          <span style={{ fontSize: 10, opacity: 0.7 }}>
                            ({(step.duration / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </Box>
                    }
                    variant={step.status === 'in_progress' ? 'filled' : 'outlined'}
                    color={step.status === 'in_progress' ? 'info' : 'default'}
                    sx={{
                      '& .MuiChip-label': { display: 'flex', alignItems: 'center' },
                    }}
                  />
                ))}
              </Box>

              {/* Duration */}
              {workflow.completedAt && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Total duration: {Math.round((new Date(workflow.completedAt) - new Date(workflow.startedAt)) / 1000 / 60)} minutes
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}

        {workflows.length === 0 && !loading && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No workflows found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create an incident to trigger the automated workflow orchestration.
              </Typography>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                onClick={() => navigate('/incidents?new=true')}
              >
                Create Incident
              </Button>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Workflows;
