/**
 * MongoDB Database Configuration
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: process.env.MONGODB_DB_NAME || 'watson_orchestrate'
        });

        logger.info(`📦 MongoDB Connected: ${conn.connection.host}`);
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });

        return conn;
    } catch (error) {
        logger.error('MongoDB connection failed:', error.message);
        logger.warn('Running in demo mode without database');
        return null;
    }
};

// Export the connectDB function and isConnected helper
module.exports = connectDB;
module.exports.isConnected = () => mongoose.connection.readyState === 1;
