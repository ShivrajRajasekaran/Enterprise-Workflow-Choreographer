import React from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Chip,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';

const workflowSteps = [
  {
    id: 'servicenow',
    label: 'Create ServiceNow Ticket',
    description: 'Create and classify incident ticket in ServiceNow',
    icon: '🎫',
  },
  {
    id: 'slack',
    label: 'Send Slack Alert',
    description: 'Alert the #incident-response channel',
    icon: '💬',
  },
  {
    id: 'github',
    label: 'Gather Diagnostics',
    description: 'Collect recent commits, logs, and metrics from GitHub',
    icon: '📊',
  },
  {
    id: 'watsonx',
    label: 'AI Root Cause Analysis',
    description: 'Analyze root cause using IBM watsonx.ai',
    icon: '🤖',
  },
  {
    id: 'confluence',
    label: 'Create Documentation',
    description: 'Create incident page in Confluence',
    icon: '📄',
  },
  {
    id: 'jira',
    label: 'Assign & Notify',
    description: 'Create Jira issue and notify assignee',
    icon: '📋',
  },
  {
    id: 'monitor',
    label: 'Monitor & Update',
    description: 'Continuous monitoring and status updates',
    icon: '👁️',
  },
];

const getStepStatus = (stepId, workflow) => {
  if (!workflow) return 'pending';
  
  const stepUpdate = workflow.steps?.find(s => s.stepId === stepId);
  if (!stepUpdate) return 'pending';
  
  return stepUpdate.status || 'pending';
};

const StepIcon = ({ status, icon }) => {
  if (status === 'completed') {
    return <CheckCircleIcon sx={{ color: '#198038', fontSize: 28 }} />;
  }
  if (status === 'failed') {
    return <ErrorIcon sx={{ color: '#da1e28', fontSize: 28 }} />;
  }
  if (status === 'in_progress') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} thickness={4} />
      </Box>
    );
  }
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        bgcolor: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
      }}
    >
      {icon}
    </Box>
  );
};

const WorkflowProgress = ({ workflow }) => {
  const activeStep = workflow?.currentStep || 0;

  return (
    <Box sx={{ mt: 2 }}>
      {workflow && (
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={<PlayArrowIcon />}
            label={`Incident: ${workflow.incidentId}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<ScheduleIcon />}
            label={`Started: ${new Date(workflow.startedAt || Date.now()).toLocaleTimeString()}`}
            variant="outlined"
          />
        </Box>
      )}

      <Stepper activeStep={activeStep} orientation="vertical">
        {workflowSteps.map((step, index) => {
          const status = getStepStatus(step.id, workflow);
          
          return (
            <Step key={step.id} completed={status === 'completed'}>
              <StepLabel
                StepIconComponent={() => <StepIcon status={status} icon={step.icon} />}
                sx={{
                  '& .MuiStepLabel-label': {
                    fontWeight: status === 'in_progress' ? 600 : 400,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2">{step.label}</Typography>
                  {status === 'in_progress' && (
                    <Chip size="small" label="In Progress" color="info" />
                  )}
                  {status === 'completed' && (
                    <Chip size="small" label="Completed" color="success" />
                  )}
                  {status === 'failed' && (
                    <Chip size="small" label="Failed" color="error" />
                  )}
                </Box>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
                {workflow?.stepResults?.[step.id] && (
                  <Paper
                    variant="outlined"
                    sx={{ mt: 1, p: 1.5, bgcolor: '#f4f4f4', fontSize: 12 }}
                  >
                    <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(workflow.stepResults[step.id], null, 2)}
                    </Typography>
                  </Paper>
                )}
              </StepContent>
            </Step>
          );
        })}
      </Stepper>

      {!workflow && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 4,
            color: 'text.secondary',
          }}
        >
          <Typography variant="h6" gutterBottom>
            No Active Workflow
          </Typography>
          <Typography variant="body2">
            Workflows will appear here when an incident triggers the orchestration process.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default WorkflowProgress;
