/**
 * Authentication Middleware
 * JWT validation and API key authentication
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'watson-orchestrate-secret-key';

/**
 * JWT Authentication Middleware
 */
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'NO_TOKEN',
                message: 'Authorization header is required'
            }
        });
    }
    
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN_FORMAT',
                message: 'Token format should be: Bearer <token>'
            }
        });
    }
    
    const token = parts[1];
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        logger.warn('JWT verification failed:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_EXPIRED',
                    message: 'Token has expired'
                }
            });
        }
        
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid token'
            }
        });
    }
};

/**
 * API Key Authentication Middleware
 */
const authenticateAPIKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'NO_API_KEY',
                message: 'API key is required'
            }
        });
    }
    
    if (apiKey !== validApiKey) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_API_KEY',
                message: 'Invalid API key'
            }
        });
    }
    
    next();
};

/**
 * Optional Authentication - allows both authenticated and anonymous access
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        req.user = null;
        return next();
    }
    
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        req.user = null;
        return next();
    }
    
    const token = parts[1];
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
    } catch (error) {
        req.user = null;
    }
    
    next();
};

/**
 * Role-based authorization middleware
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'NOT_AUTHENTICATED',
                    message: 'Authentication required'
                }
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to access this resource'
                }
            });
        }
        
        next();
    };
};

/**
 * Webhook signature validation (for external service webhooks)
 */
const validateWebhookSignature = (service) => {
    return (req, res, next) => {
        switch (service) {
            case 'slack':
                return validateSlackSignature(req, res, next);
            case 'github':
                return validateGitHubSignature(req, res, next);
            case 'servicenow':
                return validateServiceNowSignature(req, res, next);
            default:
                next();
        }
    };
};

const validateSlackSignature = (req, res, next) => {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    
    if (!signingSecret) {
        logger.warn('Slack signing secret not configured');
        return next();
    }
    
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signature = req.headers['x-slack-signature'];
    
    if (!timestamp || !signature) {
        return res.status(401).json({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Missing Slack signature headers' }
        });
    }
    
    // Check timestamp to prevent replay attacks (5 minutes)
    const time = Math.floor(Date.now() / 1000);
    if (Math.abs(time - timestamp) > 60 * 5) {
        return res.status(401).json({
            success: false,
            error: { code: 'EXPIRED_TIMESTAMP', message: 'Request timestamp too old' }
        });
    }
    
    // In production, verify the actual signature using HMAC
    // For demo, we'll allow through
    next();
};

const validateGitHubSignature = (req, res, next) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const signature = req.headers['x-hub-signature-256'];
    
    if (!secret) {
        logger.warn('GitHub webhook secret not configured');
        return next();
    }
    
    if (!signature) {
        return res.status(401).json({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Missing GitHub signature' }
        });
    }
    
    // In production, verify using crypto.createHmac
    next();
};

const validateServiceNowSignature = (req, res, next) => {
    // ServiceNow webhook validation
    next();
};

module.exports = {
    authenticateJWT,
    authenticateAPIKey,
    optionalAuth,
    requireRole,
    validateWebhookSignature
};
