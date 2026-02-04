/**
 * Workflow Routes
 * REST API endpoints for workflow management
 */

const express = require('express');
const router = express.Router();
const { param, query, validationResult } = require('express-validator');
const workflowController = require('../controllers/workflow.controller');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

/**
 * @route   GET /api/v1/workflows
 * @desc    Get all workflows
 * @access  Public
 */
router.get('/', [
    query('status').optional().isIn(['pending', 'running', 'completed', 'failed', 'cancelled']),
    query('incidentId').optional().isString().notEmpty(),
    validate
], workflowController.getAllWorkflows);

/**
 * @route   GET /api/v1/workflows/active
 * @desc    Get all active workflows
 * @access  Public
 */
router.get('/active', workflowController.getActiveWorkflows);

/**
 * @route   GET /api/v1/workflows/:id
 * @desc    Get workflow by ID
 * @access  Public
 */
router.get('/:id', [
    param('id').isString().notEmpty().withMessage('Invalid workflow ID'),
    validate
], workflowController.getWorkflowById);

/**
 * @route   GET /api/v1/workflows/:id/status
 * @desc    Get workflow execution status (for real-time updates)
 * @access  Public
 */
router.get('/:id/status', [
    param('id').isString().notEmpty().withMessage('Invalid workflow ID'),
    validate
], workflowController.getWorkflowStatus);

/**
 * @route   POST /api/v1/workflows/:id/retry
 * @desc    Retry a failed workflow
 * @access  Public
 */
router.post('/:id/retry', [
    param('id').isString().notEmpty().withMessage('Invalid workflow ID'),
    validate
], workflowController.retryWorkflow);

/**
 * @route   POST /api/v1/workflows/:id/cancel
 * @desc    Cancel a running workflow
 * @access  Public
 */
router.post('/:id/cancel', [
    param('id').isString().notEmpty().withMessage('Invalid workflow ID'),
    validate
], workflowController.cancelWorkflow);

module.exports = router;
