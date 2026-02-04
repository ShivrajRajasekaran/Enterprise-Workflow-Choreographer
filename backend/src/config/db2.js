/**
 * IBM Db2 Database Configuration
 * Enterprise-grade database connection for incident management
 */

const ibmdb = require('ibm_db');
const logger = require('../utils/logger');

// Db2 Connection Configuration
const db2Config = {
    hostname: process.env.DB2_HOSTNAME,
    port: process.env.DB2_PORT || 50000,
    database: process.env.DB2_DATABASE || 'bludb',
    username: process.env.DB2_USERNAME,
    password: process.env.DB2_PASSWORD,
    ssl: process.env.DB2_SSL === 'true'
};

// Build connection string
const buildConnectionString = () => {
    let connStr = `DATABASE=${db2Config.database};HOSTNAME=${db2Config.hostname};PORT=${db2Config.port};PROTOCOL=TCPIP;UID=${db2Config.username};PWD=${db2Config.password}`;

    if (db2Config.ssl) {
        connStr += ';Security=SSL';
    }

    return connStr;
};

// Connection pool
let connectionPool = null;

/**
 * Initialize Db2 connection pool
 */
const initializeDb2 = async () => {
    try {
        // Check if credentials are configured
        if (!db2Config.hostname || db2Config.hostname.includes('your-db2')) {
            logger.warn('IBM Db2 not configured - using in-memory storage');
            return null;
        }

        const connStr = buildConnectionString();

        // Open connection pool
        connectionPool = await new Promise((resolve, reject) => {
            ibmdb.open(connStr, (err, conn) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(conn);
                }
            });
        });

        logger.info('📦 IBM Db2 Connected Successfully');

        // Initialize tables
        await createTables(connectionPool);

        return connectionPool;
    } catch (error) {
        logger.error('IBM Db2 connection failed:', error.message);
        logger.warn('Falling back to in-memory storage');
        return null;
    }
};

/**
 * Create required tables if they don't exist
 */
const createTables = async (conn) => {
    const createIncidentsTable = `
        CREATE TABLE IF NOT EXISTS INCIDENTS (
            id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            description CLOB,
            severity VARCHAR(20),
            status VARCHAR(50) DEFAULT 'open',
            category VARCHAR(100),
            affected_services CLOB,
            servicenow_ticket_id VARCHAR(100),
            servicenow_ticket_url VARCHAR(500),
            jira_issue_key VARCHAR(50),
            jira_issue_url VARCHAR(500),
            github_issue_number INTEGER,
            github_issue_url VARCHAR(500),
            confluence_page_id VARCHAR(100),
            confluence_page_url VARCHAR(500),
            slack_channel_id VARCHAR(100),
            slack_channel_name VARCHAR(100),
            root_cause_hypothesis CLOB,
            ai_analysis CLOB,
            assigned_to CLOB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createWorkflowsTable = `
        CREATE TABLE IF NOT EXISTS WORKFLOWS (
            id VARCHAR(50) PRIMARY KEY,
            incident_id VARCHAR(50),
            status VARCHAR(50) DEFAULT 'pending',
            total_steps INTEGER,
            completed_steps INTEGER DEFAULT 0,
            failed_steps INTEGER DEFAULT 0,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            total_duration INTEGER,
            FOREIGN KEY (incident_id) REFERENCES INCIDENTS(id)
        )
    `;

    const createWorkflowStepsTable = `
        CREATE TABLE IF NOT EXISTS WORKFLOW_STEPS (
            id VARCHAR(50) PRIMARY KEY,
            workflow_id VARCHAR(50),
            step_number INTEGER,
            name VARCHAR(200),
            tool VARCHAR(100),
            status VARCHAR(50) DEFAULT 'pending',
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            duration INTEGER,
            result CLOB,
            FOREIGN KEY (workflow_id) REFERENCES WORKFLOWS(id)
        )
    `;

    try {
        // Execute table creation (Db2 doesn't support IF NOT EXISTS, so we handle errors)
        await executeQuery(conn, createIncidentsTable).catch(() => { });
        await executeQuery(conn, createWorkflowsTable).catch(() => { });
        await executeQuery(conn, createWorkflowStepsTable).catch(() => { });

        logger.info('✅ Db2 tables initialized');
    } catch (error) {
        logger.warn('Tables may already exist:', error.message);
    }
};

/**
 * Execute a SQL query
 */
const executeQuery = (conn, sql, params = []) => {
    return new Promise((resolve, reject) => {
        conn.query(sql, params, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

/**
 * Get active connection
 */
const getConnection = () => connectionPool;

/**
 * Check if Db2 is connected
 */
const isConnected = () => connectionPool !== null;

/**
 * Close connection
 */
const closeConnection = async () => {
    if (connectionPool) {
        await new Promise((resolve) => {
            connectionPool.close((err) => {
                if (err) logger.error('Error closing Db2 connection:', err);
                resolve();
            });
        });
        connectionPool = null;
        logger.info('Db2 connection closed');
    }
};

// Export functions
module.exports = {
    initializeDb2,
    getConnection,
    isConnected,
    closeConnection,
    executeQuery
};
