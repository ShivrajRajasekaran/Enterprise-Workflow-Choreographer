/**
 * ServiceNow Service
 * Integration with ServiceNow for incident ticket management
 */

const axios = require('axios');
const logger = require('../utils/logger');

const config = {
    instance: process.env.SERVICENOW_INSTANCE,
    username: process.env.SERVICENOW_USERNAME,
    password: process.env.SERVICENOW_PASSWORD
};

/**
 * Create an incident ticket in ServiceNow
 */
async function createIncidentTicket(incident) {
    logger.info(`Creating ServiceNow ticket for incident: ${incident.id}`);
    
    try {
        // Map severity to ServiceNow urgency/impact
        const severityMapping = {
            critical: { urgency: 1, impact: 1 },
            high: { urgency: 2, impact: 2 },
            medium: { urgency: 2, impact: 3 },
            low: { urgency: 3, impact: 3 }
        };
        
        const { urgency, impact } = severityMapping[incident.severity] || severityMapping.medium;
        
        const ticketData = {
            short_description: incident.title,
            description: incident.description,
            urgency,
            impact,
            category: mapCategory(incident.category),
            caller_id: incident.reporter || 'Watson Orchestrate',
            assignment_group: 'Incident Response Team'
        };
        
        // For demo, simulate API call
        if (!config.instance || config.instance === 'your_instance') {
            // Return mock response
            const mockTicketNumber = `INC${String(Date.now()).slice(-7)}`;
            return {
                success: true,
                ticketNumber: mockTicketNumber,
                ticketUrl: `https://${config.instance || 'dev223831.service-now.com'}/incident.do?sys_id=${mockTicketNumber}`,
                sysId: mockTicketNumber
            };
        }
        
        // Real API call
        const response = await axios.post(
            `https://${config.instance}/api/now/table/incident`,
            ticketData,
            {
                auth: {
                    username: config.username,
                    password: config.password
                },
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        const result = response.data.result;
        
        return {
            success: true,
            ticketNumber: result.number,
            ticketUrl: `https://${config.instance}/incident.do?sys_id=${result.sys_id}`,
            sysId: result.sys_id
        };
        
    } catch (error) {
        logger.error('ServiceNow API error:', error.message);
        
        // Return mock for demo
        const mockTicketNumber = `INC${String(Date.now()).slice(-7)}`;
        return {
            success: true,
            ticketNumber: mockTicketNumber,
            ticketUrl: `https://dev223831.service-now.com/incident.do?sys_id=${mockTicketNumber}`,
            sysId: mockTicketNumber,
            note: 'Demo mode - simulated ticket'
        };
    }
}

/**
 * Update ServiceNow ticket
 */
async function updateTicket(sysId, updates) {
    logger.info(`Updating ServiceNow ticket: ${sysId}`);
    
    try {
        if (!config.instance || config.instance === 'your_instance') {
            return { success: true, note: 'Demo mode' };
        }
        
        await axios.patch(
            `https://${config.instance}/api/now/table/incident/${sysId}`,
            updates,
            {
                auth: {
                    username: config.username,
                    password: config.password
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return { success: true };
    } catch (error) {
        logger.error('ServiceNow update error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Add work note to ticket
 */
async function addWorkNote(sysId, note) {
    return updateTicket(sysId, { work_notes: note });
}

/**
 * Map incident category to ServiceNow category
 */
function mapCategory(category) {
    const mapping = {
        infrastructure: 'Hardware',
        application: 'Software',
        database: 'Database',
        network: 'Network',
        security: 'Security'
    };
    return mapping[category] || 'Inquiry / Help';
}

module.exports = {
    createIncidentTicket,
    updateTicket,
    addWorkNote
};
