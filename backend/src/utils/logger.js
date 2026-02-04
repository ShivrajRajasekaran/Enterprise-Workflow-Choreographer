/**
 * Winston Logger Configuration
 */

const winston = require('winston');
const { format, transports } = winston;

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'watson-orchestrate-workflow' },
    transports: [
        // Console transport with colors for development
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ level, message, timestamp, ...meta }) => {
                    const metaStr = Object.keys(meta).length > 1 
                        ? JSON.stringify(meta, null, 2) 
                        : '';
                    return `${timestamp} [${level}]: ${message} ${metaStr}`;
                })
            )
        }),
        // File transport for errors
        new transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // File transport for all logs
        new transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

module.exports = logger;
