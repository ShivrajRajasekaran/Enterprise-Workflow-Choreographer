/**
 * Auth Routes
 * Authentication endpoints using OAuth 2.0
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authController.logout);

/**
 * @route   GET /api/v1/auth/ibm
 * @desc    Initiate IBM Cloud Identity OAuth flow
 * @access  Public
 */
router.get('/ibm', authController.ibmOAuthInit);

/**
 * @route   GET /api/v1/auth/ibm/callback
 * @desc    IBM Cloud Identity OAuth callback
 * @access  Public
 */
router.get('/ibm/callback', authController.ibmOAuthCallback);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authController.getCurrentUser);

module.exports = router;
