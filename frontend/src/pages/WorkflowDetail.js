import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import WorkflowProgress from '../components/WorkflowProgress';

const WorkflowDetail = () => {
  const { id } = useParams();

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Workflow Details
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Workflow ID: {id}
      </Typography>
      <WorkflowProgress />
    </Box>
  );
};

export default WorkflowDetail;
