import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useIncidents } from '../context/IncidentContext';

const severityColors = {
  critical: { bg: '#fff1f1', color: '#da1e28' },
  high: { bg: '#fff5ec', color: '#ff832b' },
  medium: { bg: '#fffaeb', color: '#f1c21b' },
  low: { bg: '#f0fff0', color: '#198038' },
};

const statusColors = {
  detected: 'default',
  acknowledged: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
};

const Incidents = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { incidents, loading, fetchIncidents, createIncident, triggerWorkflow } = useIncidents();
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [openDialog, setOpenDialog] = useState(searchParams.get('new') === 'true');
  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    severity: searchParams.get('severity') || 'medium',
    category: 'performance',
    affectedServices: '',
  });

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleCreateIncident = async () => {
    try {
      const incidentData = {
        ...newIncident,
        affectedServices: newIncident.affectedServices.split(',').map(s => s.trim()).filter(Boolean),
      };
      const created = await createIncident(incidentData);
      setOpenDialog(false);
      setNewIncident({
        title: '',
        description: '',
        severity: 'medium',
        category: 'performance',
        affectedServices: '',
      });
      
      // Automatically trigger workflow for the new incident
      if (created && (created.id || created._id)) {
        await triggerWorkflow(created.id || created._id);
      }
    } catch (error) {
      console.error('Failed to create incident:', error);
    }
  };

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = !searchTerm || 
      incident.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || incident.severity === filterSeverity;
    const matchesStatus = filterStatus === 'all' || incident.status === filterStatus;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Incidents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and track all incidents
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
            onClick={() => setOpenDialog(true)}
          >
            New Incident
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Severity</InputLabel>
              <Select
                value={filterSeverity}
                label="Severity"
                onChange={(e) => setFilterSeverity(e.target.value)}
              >
                <MenuItem value="all">All Severities</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="detected">Detected</MenuItem>
                <MenuItem value="acknowledged">Acknowledged</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Incidents Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f4f4f4' }}>
                <TableCell>Incident</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredIncidents
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((incident) => (
                  <TableRow 
                    key={incident.id || incident._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/incidents/${incident.id || incident._id}`)}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={500}>
                          {incident.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {incident.id || incident._id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={incident.severity}
                        sx={{
                          bgcolor: severityColors[incident.severity]?.bg,
                          color: severityColors[incident.severity]?.color,
                          fontWeight: 500,
                          textTransform: 'capitalize',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={incident.status?.replace('_', ' ')}
                        color={statusColors[incident.status] || 'default'}
                        variant="outlined"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {incident.category || 'General'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(incident.createdAt || incident.detectedAt).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerWorkflow(incident.id || incident._id);
                        }}
                        title="Trigger Workflow"
                      >
                        <PlayArrowIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/incidents/${incident.id || incident._id}`);
                        }}
                        title="View Details"
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              {filteredIncidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No incidents found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredIncidents.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Create Incident Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Incident</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={newIncident.title}
                onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                placeholder="Brief description of the incident"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Description"
                value={newIncident.description}
                onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                placeholder="Detailed description of the incident, symptoms, and impact"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Severity"
                value={newIncident.severity}
                onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
              >
                <MenuItem value="critical">🔴 Critical</MenuItem>
                <MenuItem value="high">🟠 High</MenuItem>
                <MenuItem value="medium">🟡 Medium</MenuItem>
                <MenuItem value="low">🟢 Low</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Category"
                value={newIncident.category}
                onChange={(e) => setNewIncident({ ...newIncident, category: e.target.value })}
              >
                <MenuItem value="database">Database</MenuItem>
                <MenuItem value="performance">Performance</MenuItem>
                <MenuItem value="network">Network</MenuItem>
                <MenuItem value="security">Security</MenuItem>
                <MenuItem value="application">Application</MenuItem>
                <MenuItem value="infrastructure">Infrastructure</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Affected Services"
                value={newIncident.affectedServices}
                onChange={(e) => setNewIncident({ ...newIncident, affectedServices: e.target.value })}
                placeholder="Comma-separated list (e.g., api-gateway, user-service, database)"
                helperText="Enter service names separated by commas"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateIncident}
            disabled={!newIncident.title || !newIncident.description}
          >
            Create & Start Workflow
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Incidents;
