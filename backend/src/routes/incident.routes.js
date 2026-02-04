/**
 * Incident Routes
 * REST API endpoints for incident management
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const incidentController = require('../controllers/incident.controller');

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

// Validation rules
const createIncidentValidation = [
    body('title').notEmpty().trim().isLength({ max: 200 }).withMessage('Title is required (max 200 chars)'),
    body('description').notEmpty().trim().withMessage('Description is required'),
    body('severity').optional().isIn(['critical', 'high', 'medium', 'low']),
    body('category').optional().isIn(['infrastructure', 'application', 'database', 'network', 'security', 'performance', 'unknown']),
    body('affectedServices').optional().isArray(),
    body('tags').optional().isArray()
];

const updateIncidentValidation = [
    param('id').isString().notEmpty().withMessage('Invalid incident ID'),
    body('title').optional().trim().isLength({ max: 200 }),
    body('description').optional().trim(),
    body('severity').optional().isIn(['critical', 'high', 'medium', 'low']),
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed'])
];

/**
 * @route   GET /api/v1/incidents
 * @desc    Get all incidents with optional filters
 * @access  Public
 */
router.get('/', [
    query('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    query('severity').optional().isIn(['critical', 'high', 'medium', 'low']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate
], incidentController.getAllIncidents);

/**
 * @route   GET /api/v1/incidents/stats
 * @desc    Get incident statistics
 * @access  Public
 */
router.get('/stats', incidentController.getIncidentStats);

/**
 * @route   GET /api/v1/incidents/:id
 * @desc    Get incident by ID
 * @access  Public
 */
router.get('/:id', [
    param('id').isString().notEmpty().withMessage('Invalid incident ID'),
    validate
], incidentController.getIncidentById);

/**
 * @route   POST /api/v1/incidents
 * @desc    Create a new incident
 * @access  Public
 */
router.post('/', createIncidentValidation, validate, incidentController.createIncident);

/**
 * @route   POST /api/v1/incidents/:id/workflow
 * @desc    Trigger workflow for an incident
 * @access  Public
 */
router.post('/:id/workflow', [
    param('id').isString().notEmpty().withMessage('Invalid incident ID'),
    validate
], incidentController.triggerWorkflow);

/**
 * @route   PUT /api/v1/incidents/:id
 * @desc    Update an incident
 * @access  Public
 */
router.put('/:id', updateIncidentValidation, validate, incidentController.updateIncident);

/**
 * @route   PUT /api/v1/incidents/:id/assign
 * @desc    Assign incident to a user
 * @access  Public
 */
router.put('/:id/assign', [
    param('id').isString().notEmpty().withMessage('Invalid incident ID'),
    body('userId').optional().isString(),
    body('name').notEmpty().withMessage('Assignee name is required'),
    body('email').optional().isEmail(),
    validate
], incidentController.assignIncident);

/**
 * @route   PUT /api/v1/incidents/:id/resolve
 * @desc    Resolve an incident
 * @access  Public
 */
router.put('/:id/resolve', [
    param('id').isString().notEmpty().withMessage('Invalid incident ID'),
    body('resolution.summary').notEmpty().withMessage('Resolution summary is required'),
    body('resolution.steps').optional().isArray(),
    validate
], incidentController.resolveIncident);

/**
 * @route   DELETE /api/v1/incidents/:id
 * @desc    Delete an incident
 * @access  Public
 */
router.delete('/:id', [
    param('id').isString().notEmpty().withMessage('Invalid incident ID'),
    validate
], incidentController.deleteIncident);

module.exports = router;
