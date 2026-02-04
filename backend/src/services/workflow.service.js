/**
 * Workflow Service
 * IBM Watson Orchestrate Workflow Execution Engine
 * 
 * Implements the 7-step incident response workflow:
 * 1. Create ServiceNow Ticket
 * 2. Send Slack Alert
 * 3. Gather Diagnostic Information
 * 4. Analyze Root Cause
 * 5. Create Confluence Page
 * 6. Assign and Notify
 * 7. Monitor and Update
 */

const logger = require('../utils/logger');
const servicenowService = require('./servicenow.service');
const slackService = require('./slack.service');
const githubService = require('./github.service');
const watsonxService = require('./watsonx.service');
const confluenceService = require('./confluence.service');
const jiraService = require('./jira.service');

// In-memory workflow store
let workflows = [];
let workflowCounter = 0;

/**
 * Create and execute a new workflow for an incident
 */
async function executeWorkflow(incident, io) {
    workflowCounter++;

    const workflow = {
        id: `WF-${String(workflowCounter).padStart(5, '0')}`,
        name: 'Incident Response Workflow',
        incidentId: incident.id,
        status: 'running',
        currentStepIndex: 0,
        completedSteps: 0,
        failedSteps: 0,
        startedAt: new Date().toISOString(),
        steps: [
            { stepNumber: 1, name: 'Create ServiceNow Ticket', tool: 'servicenow', status: 'pending' },
            { stepNumber: 2, name: 'Send Slack Alert', tool: 'slack', status: 'pending' },
            { stepNumber: 3, name: 'Gather Diagnostic Information', tool: 'github', status: 'pending' },
            { stepNumber: 4, name: 'Analyze Root Cause', tool: 'watsonx', status: 'pending' },
            { stepNumber: 5, name: 'Create Confluence Page', tool: 'confluence', status: 'pending' },
            { stepNumber: 6, name: 'Assign and Notify', tool: 'jira', status: 'pending' },
            { stepNumber: 7, name: 'Monitor and Update', tool: 'system', status: 'pending' }
        ]
    };

    workflows.push(workflow);

    logger.info(`🚀 Starting workflow ${workflow.id} for incident ${incident.id}`);

    // Emit workflow started event
    if (io) {
        io.emit('workflow:started', workflow);
    }

    // Execute steps sequentially
    executeWorkflowSteps(workflow, incident, io);

    return workflow;
}

/**
 * Execute workflow steps sequentially
 */
async function executeWorkflowSteps(workflow, incident, io) {
    for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        workflow.currentStepIndex = i;

        try {
            // Update step to running
            step.status = 'running';
            step.startedAt = new Date().toISOString();

            // Emit step started event
            if (io) {
                io.emit('workflow:step:started', { workflowId: workflow.id, step });
            }

            logger.info(`  ▶ Step ${step.stepNumber}: ${step.name}`);

            // Execute the step
            const result = await executeStep(step, incident, workflow);

            // Update step to completed
            step.status = 'completed';
            step.completedAt = new Date().toISOString();
            step.result = result;
            step.duration = new Date(step.completedAt) - new Date(step.startedAt);
            workflow.completedSteps++;

            // Update incident with step results
            updateIncidentFromStep(incident, step, result, io);

            logger.info(`  ✅ Step ${step.stepNumber} completed in ${step.duration}ms`);

            // Emit step completed event
            if (io) {
                io.emit('workflow:step:completed', { workflowId: workflow.id, step, incident });
            }

            // Small delay between steps for demo visualization
            await delay(1500);

        } catch (error) {
            // Update step to failed
            step.status = 'failed';
            step.completedAt = new Date().toISOString();
            step.result = { success: false, error: error.message };
            workflow.failedSteps++;

            logger.error(`  ❌ Step ${step.stepNumber} failed: ${error.message}`);

            // Emit step failed event
            if (io) {
                io.emit('workflow:step:failed', { workflowId: workflow.id, step, error: error.message });
            }

            // Continue to next step (or could break here for critical failures)
        }
    }

    // Complete workflow
    workflow.status = workflow.failedSteps > 0 ? 'completed_with_errors' : 'completed';
    workflow.completedAt = new Date().toISOString();
    workflow.totalDuration = new Date(workflow.completedAt) - new Date(workflow.startedAt);

    logger.info(`✅ Workflow ${workflow.id} completed in ${workflow.totalDuration}ms`);

    // Emit workflow completed event
    if (io) {
        io.emit('workflow:completed', workflow);
    }
}

/**
 * Execute a single workflow step
 */
async function executeStep(step, incident, workflow) {
    switch (step.stepNumber) {
        case 1:
            return await servicenowService.createIncidentTicket(incident);
        case 2:
            return await slackService.sendIncidentAlert(incident);
        case 3:
            // Gather diagnostics AND create visible issue on GitHub
            const diagnostics = await githubService.gatherDiagnostics(incident);
            const issueResult = await githubService.createIncidentIssue(incident);
            return { ...diagnostics, issueCreated: issueResult };
        case 4:
            return await watsonxService.analyzeRootCause(incident, workflow);
        case 5:
            // Get the analysis from step 4 if available
            const analysisStep = workflow.steps.find(s => s.stepNumber === 4);
            const diagnosticStep = workflow.steps.find(s => s.stepNumber === 3);
            return await confluenceService.createIncidentPage(
                incident,
                analysisStep?.result,
                diagnosticStep?.result
            );
        case 6:
            return await jiraService.assignAndNotify(incident);
        case 7:
            return await setupMonitoring(incident, workflow);
        default:
            throw new Error(`Unknown step: ${step.stepNumber}`);
    }
}

/**
 * Update incident with step results
 */
function updateIncidentFromStep(incident, step, result, io) {

    if (!result || !result.success) return;

    switch (step.stepNumber) {
        case 1:
            incident.servicenowTicketId = result.ticketNumber;
            incident.servicenowTicketUrl = result.ticketUrl;
            break;
        case 2:
            incident.slackChannelId = result.channelId;
            incident.slackChannelName = result.channelName;
            break;
        case 3:
            // Store GitHub issue info
            if (result.issueCreated) {
                incident.githubIssueNumber = result.issueCreated.issueNumber;
                incident.githubIssueUrl = result.issueCreated.url;
            }
            break;
        case 4:
            incident.rootCauseHypothesis = result.analysis?.rootCause || result.rootCause || 'Analysis pending';
            incident.aiAnalysis = result.analysis;
            break;
        case 5:
            incident.confluencePageId = result.pageId;
            incident.confluencePageUrl = result.pageUrl;
            break;
        case 6:
            incident.jiraIssueKey = result.issueKey;
            incident.jiraIssueUrl = result.issueUrl;
            incident.assignedTo = result.assignedTo;
            incident.status = 'in_progress';
            break;
    }

    incident.updatedAt = new Date().toISOString();

    // Save to database if it's a Mongoose document
    if (typeof incident.save === 'function') {
        incident.save().catch(err => logger.error(`Failed to save incident update for step ${step.stepNumber}:`, err));
    }

    // Emit incident updated event
    if (io) {
        io.emit('incident:updated', incident);
        if (incident.id) {
            io.to(`incident:${incident.id}`).emit('incident:updated', incident);
        }
    }
}

/**
 * Setup monitoring (Step 7)
 */
async function setupMonitoring(incident, workflow) {
    await delay(1000);

    return {
        success: true,
        monitoringEnabled: true,
        message: 'Incident monitoring and updates configured',
        dashboardUrl: `http://localhost:3000/incidents/${incident.id}`
    };
}

/**
 * Get all workflows
 */
function getAllWorkflows() {
    return workflows;
}

/**
 * Get active workflows
 */
function getActiveWorkflows() {
    return workflows.filter(w => ['pending', 'running'].includes(w.status));
}

/**
 * Get workflow by ID
 */
function getWorkflowById(id) {
    return workflows.find(w => w.id === id);
}

/**
 * Cancel a workflow
 */
function cancelWorkflow(id) {
    const workflow = workflows.find(w => w.id === id);
    if (workflow) {
        workflow.status = 'cancelled';
        workflow.completedAt = new Date().toISOString();
    }
    return workflow;
}

/**
 * Retry a failed workflow
 */
async function retryWorkflow(id, io) {
    const workflow = workflows.find(w => w.id === id);
    if (workflow) {
        // Reset failed steps to pending
        workflow.steps.forEach(step => {
            if (step.status === 'failed') {
                step.status = 'pending';
                step.result = null;
            }
        });
        workflow.status = 'running';
        workflow.failedSteps = 0;

        // Re-execute (simplified - in production, would resume from failed step)
    }
    return workflow;
}

// Utility function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    executeWorkflow,
    getAllWorkflows,
    getActiveWorkflows,
    getWorkflowById,
    cancelWorkflow,
    retryWorkflow
};
