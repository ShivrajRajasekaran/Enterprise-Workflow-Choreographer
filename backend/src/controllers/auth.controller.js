/**
 * Auth Controller
 * Authentication logic using OAuth 2.0
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Demo user for testing
const demoUser = {
    id: 'user-001',
    name: 'Shivraj R',
    email: 'rshivrajrajasekaran@gmail.com',
    role: 'admin'
};

/**
 * Login user
 */
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        // Demo login (in production, verify against database)
        if (email && password) {
            const token = jwt.sign(
                { userId: demoUser.id, email: demoUser.email },
                process.env.JWT_SECRET || 'demo-secret',
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );
            
            return res.json({
                success: true,
                data: {
                    user: demoUser,
                    token
                }
            });
        }
        
        res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Logout user
 */
exports.logout = async (req, res, next) => {
    try {
        // In a real app, you might invalidate the token in a blacklist
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Initiate IBM Cloud Identity OAuth flow
 */
exports.ibmOAuthInit = async (req, res, next) => {
    try {
        const authUrl = `${process.env.IBM_CLOUD_IDENTITY_URL}/authorize?` +
            `client_id=${process.env.IBM_CLOUD_IDENTITY_CLIENT_ID}&` +
            `response_type=code&` +
            `redirect_uri=${encodeURIComponent(process.env.IBM_CLOUD_IDENTITY_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/ibm/callback')}`;
        
        res.redirect(authUrl);
    } catch (error) {
        next(error);
    }
};

/**
 * IBM Cloud Identity OAuth callback
 */
exports.ibmOAuthCallback = async (req, res, next) => {
    try {
        const { code, error } = req.query;
        
        if (error) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=${error}`);
        }
        
        // TODO: Exchange code for token with IBM Cloud Identity
        // For demo, redirect with demo token
        
        const token = jwt.sign(
            { userId: demoUser.id, email: demoUser.email },
            process.env.JWT_SECRET || 'demo-secret',
            { expiresIn: '24h' }
        );
        
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
    } catch (error) {
        next(error);
    }
};

/**
 * Get current user
 */
exports.getCurrentUser = async (req, res, next) => {
    try {
        // In a real app, decode token and fetch user from database
        res.json({
            success: true,
            data: demoUser
        });
    } catch (error) {
        next(error);
    }
};
