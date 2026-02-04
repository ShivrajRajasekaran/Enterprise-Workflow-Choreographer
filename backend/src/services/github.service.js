/**
 * GitHub Service
 * Integration with GitHub for diagnostics and code information
 */

const { Octokit } = require('@octokit/rest');
const logger = require('../utils/logger');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

const ORG = process.env.GITHUB_ORG || 'ShivrajR369';
const DEFAULT_REPO = process.env.GITHUB_REPO || 'Demo-Incident-Report';

/**
 * Gather diagnostic information from GitHub
 */
async function gatherDiagnostics(incident) {
    logger.info(`Gathering GitHub diagnostics for incident: ${incident.id}`);

    const affectedServices = incident.affectedServices || ['core-service'];
    const diagnostics = {
        recentCommits: [],
        openPullRequests: [],
        recentDeployments: [],
        recentIssues: [],
        codeChanges: [],
        contributors: []
    };

    try {
        // Check if real token is configured
        const useRealApi = process.env.GITHUB_TOKEN &&
            !process.env.GITHUB_TOKEN.startsWith('ghp_your');

        if (useRealApi) {
            // Fetch recent commits
            for (const service of affectedServices.slice(0, 3)) {
                try {
                    const { data: commits } = await octokit.repos.listCommits({
                        owner: ORG,
                        repo: service,
                        per_page: 10,
                        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                    });

                    diagnostics.recentCommits.push(...commits.map(c => ({
                        repo: service,
                        sha: c.sha.substring(0, 7),
                        message: c.commit.message.split('\n')[0],
                        author: c.commit.author.name,
                        date: c.commit.author.date,
                        url: c.html_url
                    })));
                } catch (err) {
                    logger.warn(`Could not fetch commits for ${service}: ${err.message}`);
                }
            }

            // Fetch open PRs
            for (const service of affectedServices.slice(0, 3)) {
                try {
                    const { data: prs } = await octokit.pulls.list({
                        owner: ORG,
                        repo: service,
                        state: 'open',
                        per_page: 5
                    });

                    diagnostics.openPullRequests.push(...prs.map(pr => ({
                        repo: service,
                        number: pr.number,
                        title: pr.title,
                        author: pr.user.login,
                        url: pr.html_url,
                        createdAt: pr.created_at
                    })));
                } catch (err) {
                    logger.warn(`Could not fetch PRs for ${service}: ${err.message}`);
                }
            }

            // Fetch recent deployments (workflow runs)
            for (const service of affectedServices.slice(0, 2)) {
                try {
                    const { data: runs } = await octokit.actions.listWorkflowRunsForRepo({
                        owner: ORG,
                        repo: service,
                        per_page: 5
                    });

                    diagnostics.recentDeployments.push(...runs.workflow_runs.map(run => ({
                        repo: service,
                        workflow: run.name,
                        status: run.conclusion || run.status,
                        branch: run.head_branch,
                        triggeredBy: run.actor?.login,
                        startedAt: run.created_at,
                        url: run.html_url
                    })));
                } catch (err) {
                    logger.warn(`Could not fetch workflows for ${service}: ${err.message}`);
                }
            }
        }

        // If no data fetched, return demo data
        if (diagnostics.recentCommits.length === 0) {
            return generateDemoDiagnostics(incident);
        }

        return {
            success: true,
            data: diagnostics,
            fetchedAt: new Date().toISOString(),
            repository: `${ORG}/*`,
            affectedServices
        };

    } catch (error) {
        logger.error('GitHub diagnostics error:', error.message);
        return generateDemoDiagnostics(incident);
    }
}

/**
 * Generate demo diagnostics data
 */
function generateDemoDiagnostics(incident) {
    const now = new Date();
    const hourAgo = new Date(now - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

    return {
        success: true,
        note: 'Demo data - GitHub API not fully configured',
        data: {
            recentCommits: [
                {
                    repo: 'core-service',
                    sha: 'a1b2c3d',
                    message: 'Update database connection pool settings',
                    author: 'john.doe',
                    date: hourAgo.toISOString(),
                    url: `https://github.com/${ORG}/core-service/commit/a1b2c3d`
                },
                {
                    repo: 'core-service',
                    sha: 'e4f5g6h',
                    message: 'Add caching for frequently accessed data',
                    author: 'jane.smith',
                    date: twoHoursAgo.toISOString(),
                    url: `https://github.com/${ORG}/core-service/commit/e4f5g6h`
                },
                {
                    repo: 'api-gateway',
                    sha: 'i7j8k9l',
                    message: 'Fix timeout handling in rate limiter',
                    author: 'alex.kumar',
                    date: twoHoursAgo.toISOString(),
                    url: `https://github.com/${ORG}/api-gateway/commit/i7j8k9l`
                }
            ],
            openPullRequests: [
                {
                    repo: 'core-service',
                    number: 142,
                    title: 'Refactor connection pooling',
                    author: 'john.doe',
                    url: `https://github.com/${ORG}/core-service/pull/142`,
                    createdAt: twoHoursAgo.toISOString()
                }
            ],
            recentDeployments: [
                {
                    repo: 'core-service',
                    workflow: 'Deploy to Production',
                    status: 'success',
                    branch: 'main',
                    triggeredBy: 'ci-bot',
                    startedAt: hourAgo.toISOString(),
                    url: `https://github.com/${ORG}/core-service/actions/runs/123`
                }
            ],
            recentIssues: [
                {
                    repo: 'core-service',
                    number: 89,
                    title: 'Memory leak in connection handler',
                    labels: ['bug', 'high-priority'],
                    state: 'open'
                }
            ],
            potentialCauses: [
                'Recent commit a1b2c3d modified database connection pool settings',
                'Deployment to production completed 1 hour ago',
                'Open PR #142 related to connection pooling'
            ]
        },
        fetchedAt: now.toISOString(),
        repository: `${ORG}/*`,
        affectedServices: incident.affectedServices || ['core-service']
    };
}

/**
 * Get repository information
 */
async function getRepoInfo(repoName) {
    try {
        if (process.env.GITHUB_TOKEN && !process.env.GITHUB_TOKEN.startsWith('ghp_your')) {
            const { data } = await octokit.repos.get({
                owner: ORG,
                repo: repoName
            });
            return { success: true, data };
        }
        return {
            success: true,
            data: { name: repoName, full_name: `${ORG}/${repoName}` },
            note: 'Demo mode'
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Create an issue for the incident
 */
async function createIncidentIssue(incident) {
    try {
        // Always use the configured default repo for incident issues
        const repo = DEFAULT_REPO;

        if (process.env.GITHUB_TOKEN && !process.env.GITHUB_TOKEN.startsWith('ghp_your')) {
            const { data } = await octokit.issues.create({
                owner: ORG,
                repo: repo,
                title: `[INCIDENT] ${incident.title}`,
                body: `## Incident Details\n\n**ID:** ${incident.id}\n**Severity:** ${incident.severity}\n\n### Description\n${incident.description}\n\n### Affected Services\n${(incident.affectedServices || []).join(', ')}\n\n---\n*Created automatically by IBM Watson Orchestrate*`,
                labels: ['incident', incident.severity]
            });

            return { success: true, issueNumber: data.number, url: data.html_url };
        }

        return {
            success: true,
            issueNumber: Math.floor(Math.random() * 100) + 100,
            url: `https://github.com/${ORG}/${repo}/issues/new`,
            note: 'Demo mode'
        };
    } catch (error) {
        logger.error('GitHub issue creation error:', error.message);
        return { success: true, issueNumber: 999, note: 'Demo mode' };
    }
}

module.exports = {
    gatherDiagnostics,
    getRepoInfo,
    createIncidentIssue
};
