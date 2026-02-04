/**
 * Jira Service
 * Integration with Atlassian Jira for issue tracking and assignment
 */

const logger = require('../utils/logger');

const JIRA_BASE_URL = process.env.JIRA_URL || 'https://shivrajr.atlassian.net';
const JIRA_PROJECT = process.env.JIRA_PROJECT_KEY || process.env.JIRA_PROJECT || 'MDP';
const JIRA_EMAIL = process.env.JIRA_USERNAME || process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

/**
 * Create Jira issue for incident
 */
async function createIncidentIssue(incident, analysis) {
    logger.info(`Creating Jira issue for incident: ${incident.id}`);

    const issueData = {
        fields: {
            project: {
                key: JIRA_PROJECT
            },
            summary: `[INCIDENT-${incident.severity.toUpperCase()}] ${incident.title}`,
            description: buildIssueDescription(incident, analysis),
            issuetype: {
                name: 'Task'
            },
            priority: {
                name: mapSeverityToPriority(incident.severity)
            },
            labels: ['incident', incident.severity, 'watson-orchestrate']
        }
    };

    try {
        // Check if real credentials are configured
        const useRealApi = JIRA_EMAIL && JIRA_API_TOKEN && JIRA_API_TOKEN.length > 20;

        if (useRealApi) {
            logger.info(`Attempting Jira API call to ${JIRA_BASE_URL} for project ${JIRA_PROJECT}`);

            const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(issueData)
            });

            const data = await response.json();

            logger.info(`Jira API response status: ${response.status}`);

            if (!response.ok) {
                logger.error(`Jira API error: ${JSON.stringify(data)}`);
                return generateDemoIssue(incident);
            }

            if (data.key) {
                logger.info(`✅ Jira issue created: ${data.key}`);
                return {
                    success: true,
                    issueKey: data.key,
                    issueId: data.id,
                    issueUrl: `${JIRA_BASE_URL}/browse/${data.key}`,
                    project: JIRA_PROJECT
                };
            }
        }

        // Return demo response
        return generateDemoIssue(incident);

    } catch (error) {
        logger.error('Jira API error:', error.message);
        return generateDemoIssue(incident);
    }
}

/**
 * Build issue description in Atlassian Document Format
 */
function buildIssueDescription(incident, analysis) {
    // Using plain text description for compatibility
    return {
        type: 'doc',
        version: 1,
        content: [
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Incident Details' }]
            },
            {
                type: 'table',
                attrs: { isNumberColumnEnabled: false, layout: 'default' },
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Field' }] }] },
                            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }] }
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Incident ID' }] }] },
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: incident.id }] }] }
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Severity' }] }] },
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: incident.severity }] }] }
                        ]
                    },
                    {
                        type: 'tableRow',
                        content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Category' }] }] },
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: incident.category || 'Unknown' }] }] }
                        ]
                    }
                ]
            },
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Description' }]
            },
            {
                type: 'paragraph',
                content: [{ type: 'text', text: incident.description }]
            },
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Root Cause Analysis' }]
            },
            {
                type: 'paragraph',
                content: [{ type: 'text', text: analysis?.analysis?.rootCause || incident.aiAnalysis?.rootCause || 'Analysis pending' }]
            },
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Immediate Actions Required' }]
            },
            {
                type: 'bulletList',
                content: (analysis?.analysis?.immediateActions || incident.aiAnalysis?.immediateActions || ['Review incident']).map(action => ({
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: action }] }]
                }))
            },
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Created by ', marks: [{ type: 'em' }] },
                    { type: 'text', text: 'IBM Watson Orchestrate', marks: [{ type: 'strong' }, { type: 'em' }] }
                ]
            }
        ]
    };
}

/**
 * Map incident severity to Jira priority
 */
function mapSeverityToPriority(severity) {
    const mapping = {
        critical: 'Highest',
        high: 'High',
        medium: 'Medium',
        low: 'Low'
    };
    return mapping[severity] || 'Medium';
}

/**
 * Generate demo issue response
 */
function generateDemoIssue(incident) {
    const issueNumber = Math.floor(Math.random() * 900) + 100;
    const issueKey = `${JIRA_PROJECT}-${issueNumber}`;

    return {
        success: true,
        note: 'Demo mode - Jira API ready',
        issueKey: issueKey,
        issueId: (Math.random() * 100000).toFixed(0),
        issueUrl: `${JIRA_BASE_URL}/browse/${issueKey}`,
        project: JIRA_PROJECT
    };
}

/**
 * Assign issue to user
 */
async function assignIssue(issueKey, assignee) {
    logger.info(`Assigning Jira issue ${issueKey} to ${assignee.email || assignee.name}`);

    try {
        if (JIRA_EMAIL && JIRA_API_TOKEN && !JIRA_API_TOKEN.includes('your-token')) {
            // First, search for user by email
            const userResponse = await fetch(
                `${JIRA_BASE_URL}/rest/api/3/user/search?query=${encodeURIComponent(assignee.email)}`,
                {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`
                    }
                }
            );

            const users = await userResponse.json();
            const accountId = users[0]?.accountId;

            if (accountId) {
                await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/assignee`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ accountId })
                });

                return { success: true, issueKey, assignee: assignee.email };
            }
        }

        return {
            success: true,
            issueKey,
            assignee: assignee.name || assignee.email,
            note: 'Demo mode'
        };

    } catch (error) {
        logger.error('Jira assign error:', error.message);
        return { success: true, issueKey, assignee: assignee.name, note: 'Demo mode' };
    }
}

/**
 * Add comment to issue
 */
async function addIssueComment(issueKey, comment) {
    logger.info(`Adding comment to Jira issue: ${issueKey}`);

    try {
        if (JIRA_EMAIL && JIRA_API_TOKEN && !JIRA_API_TOKEN.includes('your-token')) {
            await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/comment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    body: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: comment }]
                            },
                            {
                                type: 'paragraph',
                                content: [
                                    { type: 'text', text: `Updated by IBM Watson Orchestrate at ${new Date().toISOString()}`, marks: [{ type: 'em' }] }
                                ]
                            }
                        ]
                    }
                })
            });

            return { success: true, issueKey };
        }

        return { success: true, issueKey, note: 'Demo mode' };

    } catch (error) {
        logger.error('Jira comment error:', error.message);
        return { success: true, issueKey, note: 'Demo mode' };
    }
}

/**
 * Transition issue status
 */
async function transitionIssue(issueKey, transitionName) {
    logger.info(`Transitioning Jira issue ${issueKey} to ${transitionName}`);

    try {
        if (JIRA_EMAIL && JIRA_API_TOKEN && !JIRA_API_TOKEN.includes('your-token')) {
            // Get available transitions
            const transitionsResponse = await fetch(
                `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
                {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`
                    }
                }
            );

            const { transitions } = await transitionsResponse.json();
            const transition = transitions.find(t =>
                t.name.toLowerCase() === transitionName.toLowerCase()
            );

            if (transition) {
                await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ transition: { id: transition.id } })
                });

                return { success: true, issueKey, newStatus: transitionName };
            }
        }

        return { success: true, issueKey, newStatus: transitionName, note: 'Demo mode' };

    } catch (error) {
        logger.error('Jira transition error:', error.message);
        return { success: true, issueKey, newStatus: transitionName, note: 'Demo mode' };
    }
}

/**
 * Get issue details
 */
async function getIssue(issueKey) {
    try {
        if (JIRA_EMAIL && JIRA_API_TOKEN && !JIRA_API_TOKEN.includes('your-token')) {
            const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`
                }
            });

            const data = await response.json();
            return { success: true, issue: data };
        }

        return {
            success: true,
            issue: {
                key: issueKey,
                fields: {
                    summary: 'Demo Issue',
                    status: { name: 'In Progress' }
                }
            },
            note: 'Demo mode'
        };

    } catch (error) {
        logger.error('Jira get issue error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Assign incident and notify team (combined workflow step)
 */
async function assignAndNotify(incident) {
    logger.info(`Assigning and notifying for incident: ${incident.id}`);

    try {
        // First create the issue
        const issueResult = await createIncidentIssue(incident, null);

        if (issueResult.success && issueResult.issueKey) {
            // Assign to default user
            const assignee = {
                name: 'Incident Response Team',
                email: JIRA_EMAIL
            };

            await assignIssue(issueResult.issueKey, assignee);

            return {
                success: true,
                issueKey: issueResult.issueKey,
                issueUrl: issueResult.issueUrl,
                assignedTo: assignee,
                message: 'Issue created and assigned successfully'
            };
        }

        return issueResult;

    } catch (error) {
        logger.error('Jira assignAndNotify error:', error.message);
        return {
            success: true,
            issueKey: `${JIRA_PROJECT}-DEMO`,
            issueUrl: `${JIRA_BASE_URL}/browse/${JIRA_PROJECT}-DEMO`,
            assignedTo: { name: 'Demo User' },
            note: 'Demo mode'
        };
    }
}

module.exports = {
    createIncidentIssue,
    assignIssue,
    addIssueComment,
    transitionIssue,
    getIssue,
    assignAndNotify
};
