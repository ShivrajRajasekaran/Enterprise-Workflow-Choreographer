/**
 * Workflow Controller
 * Business logic for workflow management
 */

const logger = require('../utils/logger');
const workflowService = require('../services/workflow.service');

/**
 * Get all workflows
 */
exports.getAllWorkflows = async (req, res, next) => {
    try {
        const { status, incidentId } = req.query;
        
        let workflows = workflowService.getAllWorkflows();
        
        if (status) {
            workflows = workflows.filter(w => w.status === status);
        }
        if (incidentId) {
            workflows = workflows.filter(w => w.incidentId === incidentId);
        }
        
        res.json({
            success: true,
            data: workflows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get active workflows
 */
exports.getActiveWorkflows = async (req, res, next) => {
    try {
        const workflows = workflowService.getActiveWorkflows();
        
        res.json({
            success: true,
            data: workflows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get workflow by ID
 */
exports.getWorkflowById = async (req, res, next) => {
    try {
        const workflow = workflowService.getWorkflowById(req.params.id);
        
        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        
        res.json({
            success: true,
            data: workflow
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get workflow status (for real-time polling)
 */
exports.getWorkflowStatus = async (req, res, next) => {
    try {
        const workflow = workflowService.getWorkflowById(req.params.id);
        
        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: workflow.id,
                status: workflow.status,
                currentStepIndex: workflow.currentStepIndex,
                completedSteps: workflow.completedSteps,
                totalSteps: workflow.steps.length,
                progressPercentage: Math.round((workflow.completedSteps / workflow.steps.length) * 100),
                steps: workflow.steps.map(s => ({
                    stepNumber: s.stepNumber,
                    name: s.name,
                    status: s.status,
                    tool: s.tool
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Retry a failed workflow
 */
exports.retryWorkflow = async (req, res, next) => {
    try {
        const workflow = workflowService.getWorkflowById(req.params.id);
        
        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        
        if (workflow.status !== 'failed') {
            return res.status(400).json({
                success: false,
                error: 'Only failed workflows can be retried'
            });
        }
        
        const io = req.app.get('io');
        const retried = await workflowService.retryWorkflow(workflow.id, io);
        
        res.json({
            success: true,
            data: retried,
            message: 'Workflow retry initiated'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel a running workflow
 */
exports.cancelWorkflow = async (req, res, next) => {
    try {
        const workflow = workflowService.getWorkflowById(req.params.id);
        
        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        
        if (!['pending', 'running'].includes(workflow.status)) {
            return res.status(400).json({
                success: false,
                error: 'Only pending or running workflows can be cancelled'
            });
        }
        
        const cancelled = workflowService.cancelWorkflow(workflow.id);
        
        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('workflow:cancelled', cancelled);
        }
        
        res.json({
            success: true,
            data: cancelled,
            message: 'Workflow cancelled'
        });
    } catch (error) {
        next(error);
    }
};
