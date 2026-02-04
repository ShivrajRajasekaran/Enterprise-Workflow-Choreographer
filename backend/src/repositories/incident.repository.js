/**
 * Db2 Incident Repository
 * Data access layer for incident operations using IBM Db2
 */

const { getConnection, isConnected, executeQuery } = require('../config/db2');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// In-memory fallback storage
const inMemoryIncidents = new Map();
let incidentCounter = 0;

/**
 * Create a new incident
 */
const createIncident = async (incidentData) => {
    const id = `INC-${String(++incidentCounter).padStart(5, '0')}`;
    const now = new Date().toISOString();

    const incident = {
        id,
        title: incidentData.title,
        description: incidentData.description,
        severity: incidentData.severity || 'medium',
        status: 'open',
        category: incidentData.category || 'general',
        affectedServices: incidentData.affectedServices || [],
        servicenowTicketId: null,
        servicenowTicketUrl: null,
        jiraIssueKey: null,
        jiraIssueUrl: null,
        githubIssueNumber: null,
        githubIssueUrl: null,
        confluencePageId: null,
        confluencePageUrl: null,
        slackChannelId: null,
        slackChannelName: null,
        rootCauseHypothesis: null,
        aiAnalysis: null,
        assignedTo: null,
        createdAt: now,
        updatedAt: now
    };

    if (isConnected()) {
        const conn = getConnection();
        const sql = `
            INSERT INTO INCIDENTS (
                id, title, description, severity, status, category,
                affected_services, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        try {
            await executeQuery(conn, sql, [
                incident.id,
                incident.title,
                incident.description,
                incident.severity,
                incident.status,
                incident.category,
                JSON.stringify(incident.affectedServices),
                incident.createdAt,
                incident.updatedAt
            ]);
            logger.info(`Incident ${id} saved to Db2`);
        } catch (error) {
            logger.error('Db2 insert error:', error.message);
            // Fall back to in-memory
            inMemoryIncidents.set(id, incident);
        }
    } else {
        // Use in-memory storage
        inMemoryIncidents.set(id, incident);
        logger.info(`Incident ${id} saved to memory (Db2 not connected)`);
    }

    return incident;
};

/**
 * Get all incidents
 */
const getAllIncidents = async () => {
    if (isConnected()) {
        const conn = getConnection();
        try {
            const results = await executeQuery(conn, 'SELECT * FROM INCIDENTS ORDER BY created_at DESC');
            return results.map(mapDbRowToIncident);
        } catch (error) {
            logger.error('Db2 query error:', error.message);
        }
    }

    // Return in-memory incidents
    return Array.from(inMemoryIncidents.values()).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );
};

/**
 * Get incident by ID
 */
const getIncidentById = async (id) => {
    if (isConnected()) {
        const conn = getConnection();
        try {
            const results = await executeQuery(conn, 'SELECT * FROM INCIDENTS WHERE id = ?', [id]);
            if (results.length > 0) {
                return mapDbRowToIncident(results[0]);
            }
        } catch (error) {
            logger.error('Db2 query error:', error.message);
        }
    }

    return inMemoryIncidents.get(id) || null;
};

/**
 * Update incident
 */
const updateIncident = async (id, updates) => {
    const now = new Date().toISOString();

    if (isConnected()) {
        const conn = getConnection();
        const setClauses = [];
        const values = [];

        const fieldMappings = {
            servicenowTicketId: 'servicenow_ticket_id',
            servicenowTicketUrl: 'servicenow_ticket_url',
            jiraIssueKey: 'jira_issue_key',
            jiraIssueUrl: 'jira_issue_url',
            githubIssueNumber: 'github_issue_number',
            githubIssueUrl: 'github_issue_url',
            confluencePageId: 'confluence_page_id',
            confluencePageUrl: 'confluence_page_url',
            slackChannelId: 'slack_channel_id',
            slackChannelName: 'slack_channel_name',
            rootCauseHypothesis: 'root_cause_hypothesis',
            aiAnalysis: 'ai_analysis',
            assignedTo: 'assigned_to',
            status: 'status'
        };

        for (const [key, value] of Object.entries(updates)) {
            const dbField = fieldMappings[key] || key;
            if (typeof value === 'object') {
                setClauses.push(`${dbField} = ?`);
                values.push(JSON.stringify(value));
            } else {
                setClauses.push(`${dbField} = ?`);
                values.push(value);
            }
        }

        setClauses.push('updated_at = ?');
        values.push(now);
        values.push(id);

        try {
            await executeQuery(conn,
                `UPDATE INCIDENTS SET ${setClauses.join(', ')} WHERE id = ?`,
                values
            );
            logger.info(`Incident ${id} updated in Db2`);
        } catch (error) {
            logger.error('Db2 update error:', error.message);
        }
    }

    // Also update in-memory
    if (inMemoryIncidents.has(id)) {
        const incident = inMemoryIncidents.get(id);
        Object.assign(incident, updates, { updatedAt: now });
        inMemoryIncidents.set(id, incident);
    }

    return getIncidentById(id);
};

/**
 * Delete incident
 */
const deleteIncident = async (id) => {
    if (isConnected()) {
        const conn = getConnection();
        try {
            await executeQuery(conn, 'DELETE FROM INCIDENTS WHERE id = ?', [id]);
            logger.info(`Incident ${id} deleted from Db2`);
        } catch (error) {
            logger.error('Db2 delete error:', error.message);
        }
    }

    inMemoryIncidents.delete(id);
    return true;
};

/**
 * Map database row to incident object
 */
const mapDbRowToIncident = (row) => {
    return {
        id: row.ID,
        title: row.TITLE,
        description: row.DESCRIPTION,
        severity: row.SEVERITY,
        status: row.STATUS,
        category: row.CATEGORY,
        affectedServices: parseJsonSafe(row.AFFECTED_SERVICES, []),
        servicenowTicketId: row.SERVICENOW_TICKET_ID,
        servicenowTicketUrl: row.SERVICENOW_TICKET_URL,
        jiraIssueKey: row.JIRA_ISSUE_KEY,
        jiraIssueUrl: row.JIRA_ISSUE_URL,
        githubIssueNumber: row.GITHUB_ISSUE_NUMBER,
        githubIssueUrl: row.GITHUB_ISSUE_URL,
        confluencePageId: row.CONFLUENCE_PAGE_ID,
        confluencePageUrl: row.CONFLUENCE_PAGE_URL,
        slackChannelId: row.SLACK_CHANNEL_ID,
        slackChannelName: row.SLACK_CHANNEL_NAME,
        rootCauseHypothesis: row.ROOT_CAUSE_HYPOTHESIS,
        aiAnalysis: parseJsonSafe(row.AI_ANALYSIS, null),
        assignedTo: parseJsonSafe(row.ASSIGNED_TO, null),
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT
    };
};

/**
 * Safely parse JSON
 */
const parseJsonSafe = (str, defaultValue) => {
    try {
        return str ? JSON.parse(str) : defaultValue;
    } catch {
        return defaultValue;
    }
};

module.exports = {
    createIncident,
    getAllIncidents,
    getIncidentById,
    updateIncident,
    deleteIncident
};
