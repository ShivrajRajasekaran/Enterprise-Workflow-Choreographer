import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

const IncidentContext = createContext(null);

export const IncidentProvider = ({ children }) => {
  const [incidents, setIncidents] = useState([]);
  const [currentIncident, setCurrentIncident] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIncidents = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/incidents', { params: filters });
      setIncidents(response.data.data || response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to fetch incidents');
      return { data: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIncident = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/incidents/${id}`);
      setCurrentIncident(response.data.data || response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to fetch incident details');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createIncident = useCallback(async (incidentData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/incidents', incidentData);
      const newIncident = response.data.data || response.data;
      setIncidents(prev => [newIncident, ...prev]);
      toast.success('Incident created successfully');
      return newIncident;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to create incident');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateIncident = useCallback(async (id, updates) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/incidents/${id}`, updates);
      const updatedIncident = response.data.data || response.data;
      setIncidents(prev => prev.map(inc => 
        inc.id === id || inc._id === id ? updatedIncident : inc
      ));
      if (currentIncident && (currentIncident.id === id || currentIncident._id === id)) {
        setCurrentIncident(updatedIncident);
      }
      toast.success('Incident updated');
      return updatedIncident;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to update incident');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentIncident]);

  const triggerWorkflow = useCallback(async (incidentId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/incidents/${incidentId}/workflow`);
      toast.info('Workflow triggered - orchestrating response...');
      return response.data;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to trigger workflow');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    incidents,
    currentIncident,
    loading,
    error,
    fetchIncidents,
    fetchIncident,
    createIncident,
    updateIncident,
    triggerWorkflow,
    setCurrentIncident,
  };

  return (
    <IncidentContext.Provider value={value}>
      {children}
    </IncidentContext.Provider>
  );
};

export const useIncidents = () => {
  const context = useContext(IncidentContext);
  if (!context) {
    throw new Error('useIncidents must be used within an IncidentProvider');
  }
  return context;
};
