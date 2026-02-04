/**
 * Webhook Routes
 * Endpoints for receiving webhooks from external tools
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

/**
 * @route   POST /api/v1/webhooks/alert
 * @desc    Receive alert webhooks from monitoring tools (Datadog, PagerDuty, etc.)
 * @access  Public
 */
router.post('/alert', webhookController.handleAlertWebhook);

/**
 * @route   POST /api/v1/webhooks/slack/events
 * @desc    Receive Slack events
 * @access  Public
 */
router.post('/slack/events', webhookController.handleSlackEvent);

/**
 * @route   POST /api/v1/webhooks/slack/interactive
 * @desc    Receive Slack interactive component events
 * @access  Public
 */
router.post('/slack/interactive', webhookController.handleSlackInteractive);

/**
 * @route   POST /api/v1/webhooks/github
 * @desc    Receive GitHub webhooks
 * @access  Public
 */
router.post('/github', webhookController.handleGitHubWebhook);

/**
 * @route   POST /api/v1/webhooks/servicenow
 * @desc    Receive ServiceNow webhooks
 * @access  Public
 */
router.post('/servicenow', webhookController.handleServiceNowWebhook);

module.exports = router;
