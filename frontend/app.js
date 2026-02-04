/**
 * IBM Watson Orchestrate - Incident Response Workflow
 * Frontend Application Logic
 */

// API Configuration
const API_BASE_URL = 'http://localhost:8000/api/v1';

// Sample Data (for demo/testing)
const sampleIncidents = [
    {
        id: 'INC-001',
        title: 'Database Connection Pool Exhausted',
        description: 'Production database experiencing connection pool exhaustion, affecting user authentication service.',
        severity: 'critical',
        status: 'in_progress',
        category: 'database',
        assignedTo: 'John Smith',
        createdAt: '2026-02-01T08:30:00Z',
        affectedServices: ['auth-service', 'user-service'],
        servicenowTicket: 'INC0012345',
        slackChannel: '#incident-001',
        confluencePage: 'https://shivrajr.atlassian.net/wiki/spaces/Hackathon/pages/123'
    },
    {
        id: 'INC-002',
        title: 'API Gateway High Latency',
        description: 'API Gateway experiencing increased latency (>2s) for all endpoints.',
        severity: 'high',
        status: 'open',
        category: 'infrastructure',
        assignedTo: 'Unassigned',
        createdAt: '2026-02-01T09:15:00Z',
        affectedServices: ['api-gateway'],
        servicenowTicket: null,
        slackChannel: null,
        confluencePage: null
    },
    {
        id: 'INC-003',
        title: 'SSL Certificate Expiring',
        description: 'SSL certificate for api.example.com expiring in 7 days.',
        severity: 'medium',
        status: 'open',
        category: 'security',
        assignedTo: 'Unassigned',
        createdAt: '2026-02-01T10:00:00Z',
        affectedServices: ['api-gateway'],
        servicenowTicket: null,
        slackChannel: null,
        confluencePage: null
    },
    {
        id: 'INC-004',
        title: 'Memory Leak in Payment Service',
        description: 'Payment service memory usage growing steadily, requires restart every 24h.',
        severity: 'high',
        status: 'in_progress',
        category: 'application',
        assignedTo: 'Sarah Johnson',
        createdAt: '2026-01-31T14:30:00Z',
        affectedServices: ['payment-service'],
        servicenowTicket: 'INC0012344',
        slackChannel: '#incident-004',
        confluencePage: 'https://shivrajr.atlassian.net/wiki/spaces/Hackathon/pages/124'
    },
    {
        id: 'INC-005',
        title: 'CDN Cache Invalidation Issue',
        description: 'CDN not properly invalidating cache for static assets.',
        severity: 'low',
        status: 'resolved',
        category: 'infrastructure',
        assignedTo: 'Mike Chen',
        createdAt: '2026-01-30T11:00:00Z',
        affectedServices: ['cdn', 'frontend'],
        servicenowTicket: 'INC0012340',
        slackChannel: '#incident-005',
        confluencePage: 'https://shivrajr.atlassian.net/wiki/spaces/Hackathon/pages/120'
    }
];

const sampleTasks = [
    { id: 'TSK-001', title: 'Investigate connection pool settings', description: 'Check PostgreSQL max_connections and pool size', incidentId: 'INC-001', status: 'in_progress' },
    { id: 'TSK-002', title: 'Review recent database commits', description: 'Check for any recent schema or query changes', incidentId: 'INC-001', status: 'completed' },
    { id: 'TSK-003', title: 'Analyze API Gateway metrics', description: 'Review Datadog metrics for latency patterns', incidentId: 'INC-002', status: 'todo' },
    { id: 'TSK-004', title: 'Check upstream services', description: 'Verify all upstream services are healthy', incidentId: 'INC-002', status: 'todo' },
    { id: 'TSK-005', title: 'Renew SSL certificate', description: 'Request new certificate from CA', incidentId: 'INC-003', status: 'todo' },
    { id: 'TSK-006', title: 'Heap dump analysis', description: 'Analyze JVM heap dump for memory leaks', incidentId: 'INC-004', status: 'in_progress' },
    { id: 'TSK-007', title: 'Code review of recent changes', description: 'Review PR #456 for potential memory issues', incidentId: 'INC-004', status: 'completed' }
];

// DOM Elements
const sidebar = document.querySelector('.sidebar');
const menuToggle = document.getElementById('menuToggle');
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.querySelector('.page-title');
const newIncidentBtn = document.getElementById('newIncidentBtn');
const newIncidentModal = document.getElementById('newIncidentModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const newIncidentForm = document.getElementById('newIncidentForm');
const incidentDetailModal = document.getElementById('incidentDetailModal');
const closeDetailModal = document.getElementById('closeDetailModal');

// State
let incidents = [...sampleIncidents];
let tasks = [...sampleTasks];
let currentWorkflowIncident = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeCharts();
    renderDashboard();
    renderIncidentsList();
    renderTasks();
    initializeModals();
    initializeWorkflowDemo();
});

// Navigation
function initializeNavigation() {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageName = item.dataset.page;
            navigateToPage(pageName);
        });
    });
}

function navigateToPage(pageName) {
    // Update nav items
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Update pages
    pages.forEach(page => {
        page.classList.toggle('active', page.id === `${pageName}-page`);
    });

    // Update title
    const titles = {
        dashboard: 'Dashboard',
        incidents: 'Incidents',
        workflow: 'Workflow',
        tasks: 'Tasks',
        integrations: 'Integrations',
        settings: 'Settings'
    };
    pageTitle.textContent = titles[pageName] || 'Dashboard';

    // Close sidebar on mobile
    if (window.innerWidth < 992) {
        sidebar.classList.remove('active');
    }
}

// Charts
function initializeCharts() {
    // Status Chart
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Open', 'In Progress', 'Resolved'],
                datasets: [{
                    data: [
                        incidents.filter(i => i.status === 'open').length,
                        incidents.filter(i => i.status === 'in_progress').length,
                        incidents.filter(i => i.status === 'resolved').length
                    ],
                    backgroundColor: ['#2196F3', '#F57C00', '#8BC34A'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Category Chart
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        new Chart(categoryCtx, {
            type: 'bar',
            data: {
                labels: ['Infrastructure', 'Application', 'Database', 'Network', 'Security'],
                datasets: [{
                    label: 'Incidents',
                    data: [2, 1, 1, 0, 1],
                    backgroundColor: '#2196F3',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
}

// Dashboard
function renderDashboard() {
    // Update stat counts
    document.getElementById('critical-count').textContent = 
        incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
    document.getElementById('high-count').textContent = 
        incidents.filter(i => i.severity === 'high' && i.status !== 'resolved').length;
    document.getElementById('medium-count').textContent = 
        incidents.filter(i => i.severity === 'medium' && i.status !== 'resolved').length;
    document.getElementById('resolved-count').textContent = 
        incidents.filter(i => i.status === 'resolved').length;

    // Render recent incidents table
    const tbody = document.getElementById('incidents-tbody');
    tbody.innerHTML = incidents.slice(0, 5).map(incident => `
        <tr onclick="showIncidentDetail('${incident.id}')">
            <td><strong>${incident.id}</strong></td>
            <td>${incident.title}</td>
            <td><span class="severity-badge ${incident.severity}">${incident.severity}</span></td>
            <td><span class="status-badge ${incident.status}">${formatStatus(incident.status)}</span></td>
            <td>${incident.assignedTo}</td>
            <td>${formatDate(incident.createdAt)}</td>
            <td>
                <button class="action-btn" onclick="event.stopPropagation(); triggerWorkflow('${incident.id}')">
                    <i class="fas fa-play"></i>
                </button>
                <button class="action-btn" onclick="event.stopPropagation(); showIncidentDetail('${incident.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Incidents List
function renderIncidentsList() {
    const container = document.getElementById('incidents-list');
    container.innerHTML = incidents.map(incident => `
        <div class="incident-card ${incident.severity}" onclick="showIncidentDetail('${incident.id}')">
            <div class="incident-info" style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <strong>${incident.id}</strong>
                    <span class="severity-badge ${incident.severity}">${incident.severity}</span>
                    <span class="status-badge ${incident.status}">${formatStatus(incident.status)}</span>
                </div>
                <h4 style="margin-bottom: 4px;">${incident.title}</h4>
                <p style="color: var(--text-secondary); font-size: 13px;">${incident.description}</p>
            </div>
            <div style="text-align: right;">
                <p style="color: var(--text-secondary); font-size: 12px;">${formatDate(incident.createdAt)}</p>
                <p style="font-weight: 500; margin-top: 4px;">${incident.assignedTo}</p>
            </div>
        </div>
    `).join('');
}

// Tasks
function renderTasks() {
    const todoContainer = document.getElementById('todo-tasks');
    const inProgressContainer = document.getElementById('inprogress-tasks');
    const completedContainer = document.getElementById('completed-tasks');

    const renderTaskCard = (task) => `
        <div class="task-card">
            <h4>${task.title}</h4>
            <p>${task.description}</p>
            <div class="task-meta">
                <span class="task-incident">${task.incidentId}</span>
            </div>
        </div>
    `;

    todoContainer.innerHTML = tasks.filter(t => t.status === 'todo').map(renderTaskCard).join('');
    inProgressContainer.innerHTML = tasks.filter(t => t.status === 'in_progress').map(renderTaskCard).join('');
    completedContainer.innerHTML = tasks.filter(t => t.status === 'completed').map(renderTaskCard).join('');
}

// Modals
function initializeModals() {
    // New Incident Modal
    newIncidentBtn.addEventListener('click', () => {
        newIncidentModal.classList.add('active');
    });

    closeModal.addEventListener('click', () => {
        newIncidentModal.classList.remove('active');
    });

    cancelBtn.addEventListener('click', () => {
        newIncidentModal.classList.remove('active');
    });

    closeDetailModal.addEventListener('click', () => {
        incidentDetailModal.classList.remove('active');
    });

    // Close modals on outside click
    [newIncidentModal, incidentDetailModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Form submission
    newIncidentForm.addEventListener('submit', handleCreateIncident);
}

// Create Incident
async function handleCreateIncident(e) {
    e.preventDefault();

    const incidentData = {
        title: document.getElementById('incidentTitle').value,
        description: document.getElementById('incidentDescription').value,
        severity: document.getElementById('incidentSeverity').value,
        category: document.getElementById('incidentCategory').value,
        affectedServices: document.getElementById('affectedServices').value.split(',').map(s => s.trim())
    };

    // Show loading state
    const submitBtn = newIncidentForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    submitBtn.disabled = true;

    try {
        // Try to call the actual API
        const response = await fetch(`${API_BASE_URL}/orchestrate/incident-workflow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(incidentData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Incident created:', result);
            addIncidentToUI(result);
        } else {
            // Fallback to demo mode
            createDemoIncident(incidentData);
        }
    } catch (error) {
        console.log('API not available, using demo mode');
        createDemoIncident(incidentData);
    }

    // Reset form and close modal
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    newIncidentForm.reset();
    newIncidentModal.classList.remove('active');

    // Navigate to workflow page and start demo
    navigateToPage('workflow');
    startWorkflowDemo();
}

function createDemoIncident(data) {
    const newIncident = {
        id: `INC-${String(incidents.length + 1).padStart(3, '0')}`,
        title: data.title,
        description: data.description,
        severity: data.severity,
        status: 'open',
        category: data.category,
        assignedTo: 'Unassigned',
        createdAt: new Date().toISOString(),
        affectedServices: data.affectedServices,
        servicenowTicket: null,
        slackChannel: null,
        confluencePage: null
    };

    incidents.unshift(newIncident);
    currentWorkflowIncident = newIncident;
    
    renderDashboard();
    renderIncidentsList();
}

function addIncidentToUI(result) {
    const newIncident = {
        id: result.incident_id || `INC-${String(incidents.length + 1).padStart(3, '0')}`,
        title: result.incident_title || 'New Incident',
        description: 'Processing...',
        severity: result.severity || 'medium',
        status: 'open',
        category: 'application',
        assignedTo: 'Unassigned',
        createdAt: new Date().toISOString(),
        affectedServices: [],
        servicenowTicket: null,
        slackChannel: null,
        confluencePage: null
    };

    incidents.unshift(newIncident);
    currentWorkflowIncident = newIncident;
    
    renderDashboard();
    renderIncidentsList();
}

// Incident Detail
function showIncidentDetail(incidentId) {
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident) return;

    const content = document.getElementById('incidentDetailContent');
    content.innerHTML = `
        <div class="detail-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3 style="font-size: 20px; margin-bottom: 8px;">${incident.title}</h3>
                    <div style="display: flex; gap: 8px;">
                        <span class="severity-badge ${incident.severity}">${incident.severity}</span>
                        <span class="status-badge ${incident.status}">${formatStatus(incident.status)}</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="triggerWorkflow('${incident.id}')">
                    <i class="fas fa-play"></i> Run Workflow
                </button>
            </div>
            <p style="color: var(--text-secondary);">${incident.description}</p>
        </div>

        <div class="detail-section">
            <h4>Incident Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Incident ID</label>
                    <span>${incident.id}</span>
                </div>
                <div class="detail-item">
                    <label>Category</label>
                    <span>${incident.category}</span>
                </div>
                <div class="detail-item">
                    <label>Created</label>
                    <span>${formatDate(incident.createdAt)}</span>
                </div>
                <div class="detail-item">
                    <label>Assigned To</label>
                    <span>${incident.assignedTo}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Affected Services</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${incident.affectedServices.map(s => `<span class="step-tool">${s}</span>`).join('')}
            </div>
        </div>

        <div class="detail-section">
            <h4>Integration Links</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>ServiceNow Ticket</label>
                    <span>${incident.servicenowTicket || 'Not created'}</span>
                </div>
                <div class="detail-item">
                    <label>Slack Channel</label>
                    <span>${incident.slackChannel || 'Not created'}</span>
                </div>
                <div class="detail-item">
                    <label>Confluence Page</label>
                    <span>${incident.confluencePage ? '<a href="' + incident.confluencePage + '" target="_blank">View Page</a>' : 'Not created'}</span>
                </div>
                <div class="detail-item">
                    <label>Jira Issue</label>
                    <span>MDP-${incident.id.split('-')[1]}</span>
                </div>
            </div>
        </div>
    `;

    incidentDetailModal.classList.add('active');
}

// Workflow Demo
function initializeWorkflowDemo() {
    // Add click handlers to workflow steps for manual progression
    const steps = document.querySelectorAll('.workflow-step');
    steps.forEach(step => {
        step.addEventListener('click', () => {
            const stepNum = parseInt(step.dataset.step);
            completeWorkflowStep(stepNum);
        });
    });
}

function triggerWorkflow(incidentId) {
    const incident = incidents.find(i => i.id === incidentId);
    if (incident) {
        currentWorkflowIncident = incident;
        incidentDetailModal.classList.remove('active');
        navigateToPage('workflow');
        resetWorkflowUI();
        startWorkflowDemo();
    }
}

function resetWorkflowUI() {
    const steps = document.querySelectorAll('.workflow-step');
    const connectors = document.querySelectorAll('.workflow-connector');

    steps.forEach(step => {
        step.classList.remove('active', 'completed');
        const status = step.querySelector('.step-status');
        status.className = 'step-status pending';
        status.innerHTML = '<i class="fas fa-clock"></i>';
    });

    connectors.forEach(conn => {
        conn.style.background = 'var(--border-color)';
    });
}

function startWorkflowDemo() {
    resetWorkflowUI();
    
    // Simulate workflow execution
    const delays = [1000, 2500, 4000, 6000, 8000, 10000, 12000];
    
    delays.forEach((delay, index) => {
        setTimeout(() => {
            completeWorkflowStep(index + 1);
        }, delay);
    });
}

function completeWorkflowStep(stepNum) {
    const steps = document.querySelectorAll('.workflow-step');
    const connectors = document.querySelectorAll('.workflow-connector');

    steps.forEach((step, index) => {
        const status = step.querySelector('.step-status');
        
        if (index + 1 < stepNum) {
            // Completed steps
            step.classList.add('completed');
            step.classList.remove('active');
            status.className = 'step-status completed';
            status.innerHTML = '<i class="fas fa-check"></i>';
        } else if (index + 1 === stepNum) {
            // Current step
            step.classList.add('active');
            step.classList.remove('completed');
            status.className = 'step-status running';
            status.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            // After a delay, mark as completed
            setTimeout(() => {
                step.classList.add('completed');
                step.classList.remove('active');
                status.className = 'step-status completed';
                status.innerHTML = '<i class="fas fa-check"></i>';
                
                // Update incident status based on step
                updateIncidentFromStep(stepNum);
            }, 1500);
        }
    });

    // Update connectors
    connectors.forEach((conn, index) => {
        if (index < stepNum - 1) {
            conn.style.background = 'var(--secondary-color)';
        }
    });
}

function updateIncidentFromStep(stepNum) {
    if (!currentWorkflowIncident) return;

    switch (stepNum) {
        case 1:
            currentWorkflowIncident.servicenowTicket = `INC00${12345 + incidents.indexOf(currentWorkflowIncident)}`;
            break;
        case 2:
            currentWorkflowIncident.slackChannel = `#incident-${currentWorkflowIncident.id.toLowerCase()}`;
            break;
        case 5:
            currentWorkflowIncident.confluencePage = `https://shivrajr.atlassian.net/wiki/spaces/Hackathon/pages/${Date.now()}`;
            break;
        case 6:
            currentWorkflowIncident.assignedTo = 'Auto-assigned';
            currentWorkflowIncident.status = 'in_progress';
            break;
        case 7:
            // Workflow complete
            showNotification('Workflow completed successfully!', 'success');
            break;
    }

    renderDashboard();
    renderIncidentsList();
}

// Utility Functions
function formatStatus(status) {
    const statusMap = {
        'open': 'Open',
        'in_progress': 'In Progress',
        'resolved': 'Resolved'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#8BC34A' : '#2196F3'};
        color: white;
        border-radius: 8px;
        font-weight: 500;
        z-index: 3000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Export for global access
window.showIncidentDetail = showIncidentDetail;
window.triggerWorkflow = triggerWorkflow;
