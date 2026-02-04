/**
 * Health Check Routes
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * @route   GET /api/v1/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV,
        services: {}
    };

    // Check MongoDB connection
    try {
        health.services.mongodb = mongoose.connection.readyState === 1 
            ? { status: 'connected', host: mongoose.connection.host }
            : { status: 'disconnected' };
    } catch (error) {
        health.services.mongodb = { status: 'error', error: error.message };
    }

    // Overall status
    const allHealthy = Object.values(health.services).every(
        s => s.status === 'connected' || s.status === 'ok'
    );

    if (!allHealthy) {
        health.status = 'degraded';
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

/**
 * @route   GET /api/v1/health/live
 * @desc    Liveness probe for Kubernetes
 * @access  Public
 */
router.get('/live', (req, res) => {
    res.status(200).json({ status: 'alive' });
});

/**
 * @route   GET /api/v1/health/ready
 * @desc    Readiness probe for Kubernetes
 * @access  Public
 */
router.get('/ready', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ 
        status: ready ? 'ready' : 'not_ready',
        database: ready ? 'connected' : 'disconnected'
    });
});

module.exports = router;
