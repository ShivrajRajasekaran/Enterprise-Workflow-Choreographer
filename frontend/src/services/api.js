import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.error?.message || error.message;
      console.error('API Error:', message);
      
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        // Optionally redirect to login
      }
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;

// Incident API
export const incidentAPI = {
  getAll: (params) => api.get('/incidents', { params }),
  getById: (id) => api.get(`/incidents/${id}`),
  create: (data) => api.post('/incidents', data),
  update: (id, data) => api.patch(`/incidents/${id}`, data),
  delete: (id) => api.delete(`/incidents/${id}`),
  triggerWorkflow: (id) => api.post(`/incidents/${id}/workflow`),
  getStats: () => api.get('/incidents/stats'),
};

// Workflow API
export const workflowAPI = {
  getAll: (params) => api.get('/workflows', { params }),
  getById: (id) => api.get(`/workflows/${id}`),
  getByIncident: (incidentId) => api.get(`/workflows/incident/${incidentId}`),
  getSteps: (id) => api.get(`/workflows/${id}/steps`),
};

// Webhook API
export const webhookAPI = {
  simulateServiceNow: (data) => api.post('/webhooks/servicenow', data),
  simulateSlack: (data) => api.post('/webhooks/slack', data),
  simulateGitHub: (data) => api.post('/webhooks/github', data),
};

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  logout: () => api.post('/auth/logout'),
};
