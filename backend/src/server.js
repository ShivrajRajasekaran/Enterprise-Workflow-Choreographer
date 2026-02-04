/**
 * IBM Watson Orchestrate - Main Server Entry Point
 * Express.js Backend Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('./utils/logger');
const connectDB = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');

// Import Routes
const incidentRoutes = require('./routes/incident.routes');
const workflowRoutes = require('./routes/workflow.routes');
const webhookRoutes = require('./routes/webhook.routes');
const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time updates
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
        methods: ['GET', 'POST']
    }
});

// Make io available to routes
app.set('io', io);

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true
}));

// Request Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
}));

// API Routes
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

app.use(`${API_PREFIX}/incidents`, incidentRoutes);
app.use(`${API_PREFIX}/workflows`, workflowRoutes);
app.use(`${API_PREFIX}/webhooks`, webhookRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/health`, healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'IBM Watson Orchestrate - Incident Response Workflow',
        version: '1.0.0',
        description: 'Multi-tool Enterprise Workflow Choreographer',
        documentation: `${API_PREFIX}/docs`,
        health: `${API_PREFIX}/health`
    });
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('subscribe:incident', (incidentId) => {
        socket.join(`incident:${incidentId}`);
        logger.info(`Socket ${socket.id} subscribed to incident ${incidentId}`);
    });

    socket.on('subscribe:workflow', (workflowId) => {
        socket.join(`workflow:${workflowId}`);
        logger.info(`Socket ${socket.id} subscribed to workflow ${workflowId}`);
    });

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Error Handler (must be last)
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Start Server
const PORT = process.env.PORT || 3001;

const startServer = async () => {
    try {
        // Try to connect to MongoDB (optional in dev mode)
        try {
            await connectDB();
        } catch (dbError) {
            logger.warn('MongoDB not available - running in demo mode');
        }

        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 API Base: http://localhost:${PORT}${API_PREFIX}`);
            console.log(`💡 IBM Watson Orchestrate Workflow Ready`);
            logger.info(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

startServer();

module.exports = { app, server, io };
