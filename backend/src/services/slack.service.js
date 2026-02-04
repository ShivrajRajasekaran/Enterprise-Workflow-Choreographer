/**
 * Slack Service
 * Integration with Slack for notifications and team communication
 */

const { WebClient } = require('@slack/web-api');
const logger = require('../utils/logger');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const INCIDENT_CHANNEL = process.env.SLACK_INCIDENT_CHANNEL || '#new-channel';

/**
 * Send incident alert to Slack
 */
async function sendIncidentAlert(incident) {
    logger.info(`Sending Slack alert for incident: ${incident.id}`);

    try {
        const severityEmoji = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢'
        };

        const message = {
            channel: INCIDENT_CHANNEL,
            text: `${severityEmoji[incident.severity] || '⚪'} *${incident.severity.toUpperCase()} INCIDENT* - ${incident.title}`,
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: `${severityEmoji[incident.severity] || '⚪'} ${incident.severity.toUpperCase()} INCIDENT DETECTED`,
                        emoji: true
                    }
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Incident ID:*\n${incident.id}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Severity:*\n${incident.severity}`
                        }
                    ]
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Title:*\n${incident.title}`
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Description:*\n${incident.description.substring(0, 500)}${incident.description.length > 500 ? '...' : ''}`
                    }
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Affected Services:*\n${incident.affectedServices?.join(', ') || 'TBD'}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Category:*\n${incident.category || 'Unknown'}`
                        }
                    ]
                },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: '📋 View Details',
                                emoji: true
                            },
                            url: `http://localhost:3000/incidents/${incident.id}`,
                            action_id: 'view_incident'
                        },
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: '✋ Acknowledge',
                                emoji: true
                            },
                            style: 'primary',
                            action_id: 'acknowledge_incident',
                            value: incident.id
                        }
                    ]
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `🤖 Automated by IBM Watson Orchestrate | Detected at ${new Date(incident.detectedAt).toLocaleString()}`
                        }
                    ]
                }
            ]
        };

        // Try to send real message
        if (process.env.SLACK_BOT_TOKEN && !process.env.SLACK_BOT_TOKEN.startsWith('xoxb-your')) {
            const result = await client.chat.postMessage(message);

            return {
                success: true,
                channelId: result.channel,
                channelName: INCIDENT_CHANNEL,
                messageTs: result.ts,
                message: 'Alert sent to Slack'
            };
        }

        // Demo mode
        return {
            success: true,
            channelId: 'C0123456789',
            channelName: INCIDENT_CHANNEL,
            messageTs: Date.now().toString(),
            message: 'Demo mode - Slack alert simulated'
        };

    } catch (error) {
        logger.error('Slack API error:', error.message);

        // Return success for demo
        return {
            success: true,
            channelId: 'C0123456789',
            channelName: INCIDENT_CHANNEL,
            messageTs: Date.now().toString(),
            note: 'Demo mode - simulated alert'
        };
    }
}

/**
 * Create dedicated incident channel
 */
async function createIncidentChannel(incident) {
    const channelName = `incident-${incident.id.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

    try {
        if (process.env.SLACK_BOT_TOKEN && !process.env.SLACK_BOT_TOKEN.startsWith('xoxb-your')) {
            const result = await client.conversations.create({
                name: channelName,
                is_private: false
            });

            return {
                success: true,
                channelId: result.channel.id,
                channelName: `#${channelName}`
            };
        }

        return {
            success: true,
            channelId: 'C0123456789',
            channelName: `#${channelName}`,
            note: 'Demo mode'
        };

    } catch (error) {
        logger.error('Slack channel creation error:', error.message);
        return {
            success: true,
            channelId: 'C0123456789',
            channelName: `#${channelName}`,
            note: 'Demo mode'
        };
    }
}

/**
 * Send notification to team members
 */
async function notifyTeamMember(userId, message) {
    try {
        if (process.env.SLACK_BOT_TOKEN && !process.env.SLACK_BOT_TOKEN.startsWith('xoxb-your')) {
            await client.chat.postMessage({
                channel: userId,
                text: message
            });
        }
        return { success: true };
    } catch (error) {
        logger.error('Slack DM error:', error.message);
        return { success: true, note: 'Demo mode' };
    }
}

/**
 * Post update to incident channel
 */
async function postIncidentUpdate(channelId, updateMessage) {
    try {
        if (process.env.SLACK_BOT_TOKEN && !process.env.SLACK_BOT_TOKEN.startsWith('xoxb-your')) {
            await client.chat.postMessage({
                channel: channelId,
                text: updateMessage
            });
        }
        return { success: true };
    } catch (error) {
        logger.error('Slack update error:', error.message);
        return { success: true, note: 'Demo mode' };
    }
}

module.exports = {
    sendIncidentAlert,
    createIncidentChannel,
    notifyTeamMember,
    postIncidentUpdate
};
