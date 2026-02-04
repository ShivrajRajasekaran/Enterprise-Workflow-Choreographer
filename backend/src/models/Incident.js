/**
 * Incident Mongoose Model
 * Database schema for incident records
 */

const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
    // Basic Information
    id: {
        type: String,
        unique: true,
        index: true
    },
    title: {
        type: String,
        required: [true, 'Incident title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Incident description is required'],
        trim: true
    },

    // Classification
    severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low'],
        default: 'medium',
        index: true
    },
    category: {
        type: String,
        enum: ['infrastructure', 'application', 'database', 'network', 'security', 'unknown'],
        default: 'unknown'
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open',
        index: true
    },

    // Source Information
    source: {
        type: String,
        enum: ['manual', 'alert', 'webhook', 'api'],
        default: 'manual'
    },
    reporter: {
        type: String,
        default: 'System'
    },

    // Affected Systems
    affectedServices: [{
        type: String,
        trim: true
    }],
    tags: [{
        type: String,
        trim: true
    }],

    // Integration References
    servicenowTicketId: {
        type: String,
        sparse: true
    },
    servicenowTicketUrl: String,

    slackChannelId: String,
    slackChannelName: String,
    slackThreadTs: String,

    confluencePageId: String,
    confluencePageUrl: String,

    jiraIssueId: String,
    jiraIssueKey: String,
    jiraIssueUrl: String,

    githubIssueNumber: Number,
    githubIssueUrl: String,

    // Analysis Results
    rootCauseHypothesis: String,
    aiAnalysis: {
        rootCause: String,
        contributingFactors: [String],
        confidence: String,
        confidenceScore: Number,
        immediateActions: [String],
        recommendations: [String],
        estimatedTimeToResolve: String,
        analyzedAt: Date,
        suggestedActions: [String], // kept for backward compatibility if needed
        relatedCommits: [{
            sha: String,
            message: String,
            author: String,
            url: String,
            relevanceScore: Number
        }]
    },

    // Assignment
    assignedTo: {
        userId: String,
        name: String,
        email: String,
        slackId: String
    },
    assignedTeam: String,
    responders: [{
        userId: String,
        name: String,
        role: String,
        joinedAt: Date
    }],

    // Timeline
    detectedAt: {
        type: Date,
        default: Date.now
    },
    acknowledgedAt: Date,
    resolvedAt: Date,
    closedAt: Date,

    // Metrics
    timeToAcknowledge: Number, // milliseconds
    timeToResolve: Number, // milliseconds

    // Resolution
    resolution: {
        summary: String,
        steps: [String],
        preventiveMeasures: [String]
    },

    // Workflow Tracking
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workflow'
    },
    workflowStatus: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },

    // Metadata
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
IncidentSchema.index({ createdAt: -1 });
IncidentSchema.index({ severity: 1, status: 1 });
IncidentSchema.index({ 'assignedTo.userId': 1 });

// Virtual for incident age
IncidentSchema.virtual('age').get(function () {
    return Date.now() - this.detectedAt;
});

// Pre-save hook to calculate metrics
IncidentSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        if (this.status === 'in_progress' && !this.acknowledgedAt) {
            this.acknowledgedAt = new Date();
            this.timeToAcknowledge = this.acknowledgedAt - this.detectedAt;
        }
        if (this.status === 'resolved' && !this.resolvedAt) {
            this.resolvedAt = new Date();
            this.timeToResolve = this.resolvedAt - this.detectedAt;
        }
    }
    next();
});

// Static method to get severity counts
IncidentSchema.statics.getSeverityCounts = async function () {
    return this.aggregate([
        { $match: { status: { $ne: 'closed' } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);
};

// Static method to get open incidents
IncidentSchema.statics.getOpenIncidents = function () {
    return this.find({ status: { $in: ['open', 'in_progress'] } })
        .sort({ severity: 1, createdAt: -1 });
};

module.exports = mongoose.model('Incident', IncidentSchema);
