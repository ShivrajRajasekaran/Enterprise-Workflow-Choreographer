/**
 * IBM watsonx AI Service
 * Integration with IBM watsonx.ai for intelligent root cause analysis
 */

const logger = require('../utils/logger');

const WATSONX_API_KEY = process.env.WATSONX_API_KEY;
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID || '27409073-77ff-4ac5-8385-8305c1301b6f';
const WATSONX_REGION = process.env.WATSONX_REGION || 'us-south';
const WATSONX_URL = `https://${WATSONX_REGION}.ml.cloud.ibm.com`;

/**
 * Get IBM Cloud IAM token
 */
async function getIAMToken() {
    try {
        const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_API_KEY}`
        });

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        logger.error('IAM token error:', error.message);
        return null;
    }
}

/**
 * Analyze incident and determine root cause using IBM watsonx
 */
async function analyzeRootCause(incident, diagnosticData) {
    logger.info(`Analyzing root cause for incident: ${incident.id}`);

    const prompt = buildAnalysisPrompt(incident, diagnosticData);

    try {
        // Check if real API key is configured
        if (WATSONX_API_KEY && !WATSONX_API_KEY.includes('your-api-key')) {
            const token = await getIAMToken();

            if (token) {
                // Add timeout for IP/Firewall issues
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                try {
                    const response = await fetch(`${WATSONX_URL}/ml/v1/text/generation?version=2024-01-01`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            model_id: 'ibm/granite-3-8b-instruct',
                            project_id: WATSONX_PROJECT_ID,
                            input: prompt,
                            parameters: {
                                decoding_method: 'greedy',
                                max_new_tokens: 1000,
                                min_new_tokens: 100,
                                stop_sequences: [],
                                repetition_penalty: 1.1
                            }
                        }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`WatsonX API error: ${response.status} ${response.statusText}`);
                    }

                    const data = await response.json();

                    if (data.results && data.results[0]) {
                        const analysisText = data.results[0].generated_text;
                        return parseAnalysisResponse(analysisText, incident);
                    }
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    logger.warn(`WatsonX API call failed (using demo fallback): ${fetchError.message}`);
                    // Fallthrough to demo
                }
            }
        }

        // Return intelligent demo analysis
        return generateDemoAnalysis(incident, diagnosticData);

    } catch (error) {
        logger.error('watsonx analysis error:', error.message);
        return generateDemoAnalysis(incident, diagnosticData);
    }
}

/**
 * Build analysis prompt for watsonx
 */
function buildAnalysisPrompt(incident, diagnosticData) {
    return `You are an expert Site Reliability Engineer (SRE) analyzing a production incident. Analyze the following incident and provide root cause analysis with recommendations.

## Incident Information
- **ID:** ${incident.id}
- **Title:** ${incident.title}
- **Severity:** ${incident.severity}
- **Description:** ${incident.description}
- **Affected Services:** ${(incident.affectedServices || []).join(', ')}
- **Category:** ${incident.category || 'Unknown'}

## Diagnostic Data
### Recent Commits (last 24 hours)
${formatCommits(diagnosticData?.data?.recentCommits || [])}

### Recent Deployments
${formatDeployments(diagnosticData?.data?.recentDeployments || [])}

### Open Pull Requests
${formatPRs(diagnosticData?.data?.openPullRequests || [])}

## Analysis Request
Based on the incident information and diagnostic data, provide:

1. **Root Cause Analysis:** What is the most likely cause of this incident?
2. **Contributing Factors:** What other factors may have contributed?
3. **Confidence Level:** How confident are you in this analysis? (High/Medium/Low)
4. **Immediate Actions:** What should be done immediately to mitigate the issue?
5. **Long-term Recommendations:** What changes would prevent this in the future?
6. **Estimated Time to Resolve:** Based on similar incidents

Please structure your response clearly with these sections.`;
}

function formatCommits(commits) {
    if (commits.length === 0) return 'No recent commits available';
    return commits.map(c => `- ${c.sha}: "${c.message}" by ${c.author} at ${c.date}`).join('\n');
}

function formatDeployments(deployments) {
    if (deployments.length === 0) return 'No recent deployments available';
    return deployments.map(d => `- ${d.workflow} (${d.status}) on ${d.branch} at ${d.startedAt}`).join('\n');
}

function formatPRs(prs) {
    if (prs.length === 0) return 'No open PRs';
    return prs.map(pr => `- PR # ${pr.number}: "${pr.title}" by ${pr.author}`).join('\n');
}

/**
 * Parse watsonx response into structured format using robust positional parsing
 */
function parseAnalysisResponse(text, incident) {
    logger.info(`🤖 Raw Watsonx Response for ${incident.id}:\n${text}\n-----------------------------------`);

    const sectionMap = {
        rootCause: ['Root Cause', 'Analysis', '1. Root Cause'],
        contributingFactors: ['Contributing Factors', 'Factors', '2. Contributing Factors'],
        confidence: ['Confidence Level', 'Confidence', '3. Confidence'],
        immediateActions: ['Immediate Actions', 'Actions', '4. Immediate Actions'],
        recommendations: ['Long-term Recommendations', 'Recommendations', '5. Long-term Recommendations'],
        estimatedTimeToResolve: ['Estimated Time to Resolve', 'Time to Resolve', 'ETA', '6. Estimated']
    };

    const foundSections = [];

    // Find start positions of all sections
    Object.keys(sectionMap).forEach(key => {
        const keywords = sectionMap[key];
        let bestIndex = -1;
        let bestMatchLength = 0;

        keywords.forEach(kw => {
            // Flexible regex to match headers
            const regex = new RegExp(`(?:^|\\n)\\s*(?:\\*\\*|###|\\d+\\.)?\\s*${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\*\\*)?[:\\s]*`, 'i');
            const match = text.match(regex);
            if (match) {
                if (bestIndex === -1 || match.index < bestIndex) {
                    bestIndex = match.index;
                    bestMatchLength = match[0].length;
                }
            }
        });

        if (bestIndex !== -1) {
            foundSections.push({ key, start: bestIndex, contentStart: bestIndex + bestMatchLength });
        }
    });

    // Sort sections by position in text
    foundSections.sort((a, b) => a.start - b.start);

    // Extract content based on positions
    const parsedData = {};
    foundSections.forEach((section, i) => {
        const nextSection = foundSections[i + 1];
        const endPos = nextSection ? nextSection.start : text.length;

        // Extract raw chunk from the end of the header
        let content = text.substring(section.contentStart, endPos).trim();
        parsedData[section.key] = content;
    });

    // Handle missing Root Cause (fallback to entire text if extremely short or missing)
    if (!parsedData.rootCause && text.length < 500) {
        parsedData.rootCause = text;
    }

    // Helper to parse lists
    const parseList = (textChunk) => {
        if (!textChunk) return [];
        return textChunk.split(/[\n•-]/)
            .map(s => s.trim())
            .filter(s => s.length > 3 && !s.match(/^(?:\*\\*|###|\\d+\\.)/)); // Filter out headers
    };

    // Calculate confidence
    let confidence = 'medium';
    let confidenceScore = 0.75;
    if (parsedData.confidence) {
        const match = parsedData.confidence.match(/(high|medium|low)/i);
        if (match) confidence = match[1].toLowerCase();
        confidenceScore = confidence === 'high' ? 0.9 : confidence === 'low' ? 0.5 : 0.75;
    }

    return {
        success: true,
        analysis: {
            rootCause: parsedData.rootCause || 'Root cause analysis pending.',
            contributingFactors: parseList(parsedData.contributingFactors),
            confidence: confidence,
            confidenceScore: confidenceScore,
            immediateActions: parseList(parsedData.immediateActions),
            recommendations: parseList(parsedData.recommendations),
            estimatedTimeToResolve: parsedData.estimatedTimeToResolve || '2-4 hours',
            analyzedAt: new Date().toISOString(),
            model: 'ibm/granite-3-8b-instruct',
            rawResponse: text
        },
        incidentId: incident.id
    };
}

/**
 * Generate intelligent demo analysis
 */
function generateDemoAnalysis(incident, diagnosticData) {
    // Build contextual analysis based on incident data
    const category = incident.category?.toLowerCase() || 'performance';
    const severity = incident.severity;

    const analyses = {
        database: {
            rootCause: 'Database connection pool exhaustion due to long-running queries and increased traffic. Recent commit a1b2c3d modified connection pool settings which may have reduced the available connections.',
            contributingFactors: [
                'Recent deployment changed database connection pool configuration',
                'Traffic spike during peak hours exceeded connection limits',
                'Missing query optimization causing slow response times',
                'Connection leak in error handling paths'
            ],
            immediateActions: [
                'Increase connection pool size temporarily (max_connections: 100 → 200)',
                'Kill long-running queries that are blocking others',
                'Enable connection pool metrics monitoring',
                'Scale up database read replicas if available'
            ],
            recommendations: [
                'Implement query timeout limits (30s max)',
                'Add circuit breaker pattern for database calls',
                'Review and optimize slow queries',
                'Set up automated connection pool health checks'
            ],
            estimatedTimeToResolve: '1-2 hours'
        },
        performance: {
            rootCause: 'Memory pressure and CPU saturation causing degraded response times. Analysis of recent commits shows changes to caching logic that may have increased memory footprint.',
            contributingFactors: [
                'Memory leak in caching layer',
                'Recent code changes affected garbage collection patterns',
                'High CPU utilization from unoptimized algorithms',
                'External API calls timing out and causing retries'
            ],
            immediateActions: [
                'Restart affected service instances to clear memory',
                'Enable rate limiting to reduce load',
                'Increase instance count for horizontal scaling',
                'Disable non-critical background jobs temporarily'
            ],
            recommendations: [
                'Implement proper memory management in caching',
                'Add performance regression tests to CI/CD',
                'Set up memory and CPU alerting thresholds',
                'Optimize hot code paths identified in profiling'
            ],
            estimatedTimeToResolve: '2-3 hours'
        },
        network: {
            rootCause: 'Network connectivity issues between microservices caused by DNS resolution failures and intermittent timeouts to external dependencies.',
            contributingFactors: [
                'DNS cache TTL too short causing frequent lookups',
                'Network partition in one availability zone',
                'Load balancer health check configuration',
                'External API rate limiting'
            ],
            immediateActions: [
                'Increase DNS cache TTL',
                'Route traffic away from affected zone',
                'Update timeout configurations',
                'Enable circuit breaker for external calls'
            ],
            recommendations: [
                'Implement service mesh for better traffic management',
                'Add retry logic with exponential backoff',
                'Set up multi-region failover',
                'Create runbooks for network issues'
            ],
            estimatedTimeToResolve: '1-2 hours'
        },
        security: {
            rootCause: 'Unauthorized access attempts detected from suspicious IP ranges, potentially indicating a coordinated attack or credential compromise.',
            contributingFactors: [
                'Exposed API endpoint without proper authentication',
                'Brute force login attempts',
                'Missing rate limiting on auth endpoints',
                'Outdated dependency with known vulnerability'
            ],
            immediateActions: [
                'Block suspicious IP ranges immediately',
                'Rotate compromised credentials',
                'Enable enhanced logging and monitoring',
                'Force password reset for affected users'
            ],
            recommendations: [
                'Implement Web Application Firewall (WAF)',
                'Enable multi-factor authentication',
                'Conduct security audit of all endpoints',
                'Update vulnerable dependencies'
            ],
            estimatedTimeToResolve: '4-6 hours'
        }
    };

    const analysis = analyses[category] || analyses.performance;
    const confidence = severity === 'critical' ? 'high' : severity === 'high' ? 'medium' : 'low';

    return {
        success: true,
        note: 'Demo analysis - IBM watsonx.ai integration ready',
        analysis: {
            rootCause: analysis.rootCause,
            contributingFactors: analysis.contributingFactors,
            confidence: confidence,
            confidenceScore: confidence === 'high' ? 0.92 : confidence === 'medium' ? 0.78 : 0.65,
            immediateActions: analysis.immediateActions,
            recommendations: analysis.recommendations,
            estimatedTimeToResolve: analysis.estimatedTimeToResolve,
            analyzedAt: new Date().toISOString(),
            model: 'ibm/granite-3-8b-instruct',
            projectId: WATSONX_PROJECT_ID
        },
        incidentId: incident.id,
        diagnosticsUsed: {
            recentCommits: diagnosticData?.data?.recentCommits?.length || 0,
            recentDeployments: diagnosticData?.data?.recentDeployments?.length || 0,
            openPRs: diagnosticData?.data?.openPullRequests?.length || 0
        }
    };
}

/**
 * Get recommended assignee based on analysis
 */
async function recommendAssignee(incident, analysis) {
    // Determine best team based on incident category and analysis
    const categoryTeamMap = {
        database: { team: 'database-team', expertise: ['DBA', 'Backend'] },
        performance: { team: 'platform-team', expertise: ['SRE', 'Performance'] },
        network: { team: 'infrastructure-team', expertise: ['Network', 'DevOps'] },
        security: { team: 'security-team', expertise: ['Security', 'Compliance'] },
        application: { team: 'application-team', expertise: ['Backend', 'Frontend'] }
    };

    const category = incident.category?.toLowerCase() || 'application';
    const teamInfo = categoryTeamMap[category] || categoryTeamMap.application;

    // Demo users for assignment
    const demoUsers = {
        'database-team': { name: 'Sarah Chen', email: 'sarah.chen@example.com', slack: '@sarah.chen' },
        'platform-team': { name: 'Mike Johnson', email: 'mike.johnson@example.com', slack: '@mike.johnson' },
        'infrastructure-team': { name: 'Alex Kumar', email: 'alex.kumar@example.com', slack: '@alex.kumar' },
        'security-team': { name: 'Lisa Wang', email: 'lisa.wang@example.com', slack: '@lisa.wang' },
        'application-team': { name: 'John Smith', email: 'john.smith@example.com', slack: '@john.smith' }
    };

    return {
        success: true,
        recommendation: {
            team: teamInfo.team,
            expertise: teamInfo.expertise,
            primaryAssignee: demoUsers[teamInfo.team],
            reasoning: `Based on incident category "${category}" and root cause analysis, the ${teamInfo.team} is best suited to handle this issue.`
        }
    };
}

module.exports = {
    analyzeRootCause,
    recommendAssignee
};
