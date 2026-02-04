/**
 * Workflow Mongoose Model
 * Database schema for workflow execution records
 */

const mongoose = require('mongoose');

const WorkflowStepSchema = new mongoose.Schema({
    stepNumber: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    tool: {
        type: String,
        enum: ['servicenow', 'slack', 'github', 'confluence', 'jira', 'watsonx', 'system'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
        default: 'pending'
    },
    startedAt: Date,
    completedAt: Date,
    duration: Number, // milliseconds
    result: {
        success: Boolean,
        data: mongoose.Schema.Types.Mixed,
        error: String
    },
    retryCount: {
        type: Number,
        default: 0
    }
}, { _id: false });

const WorkflowSchema = new mongoose.Schema({
    // Workflow Information
    name: {
        type: String,
        required: true,
        default: 'Incident Response Workflow'
    },
    description: String,
    version: {
        type: String,
        default: '1.0.0'
    },
    
    // Associated Incident
    incidentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Incident',
        required: true,
        index: true
    },
    
    // Workflow Status
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    
    // Steps
    steps: [WorkflowStepSchema],
    currentStepIndex: {
        type: Number,
        default: 0
    },
    
    // Timing
    startedAt: Date,
    completedAt: Date,
    totalDuration: Number, // milliseconds
    
    // Results
    completedSteps: {
        type: Number,
        default: 0
    },
    failedSteps: {
        type: Number,
        default: 0
    },
    
    // Error Handling
    lastError: {
        step: Number,
        message: String,
        timestamp: Date
    },
    
    // Trigger Information
    triggeredBy: {
        type: String,
        enum: ['automatic', 'manual', 'webhook', 'schedule'],
        default: 'automatic'
    },
    triggeredByUser: String,
    
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

// Virtual for progress percentage
WorkflowSchema.virtual('progressPercentage').get(function() {
    if (this.steps.length === 0) return 0;
    return Math.round((this.completedSteps / this.steps.length) * 100);
});

// Method to initialize default workflow steps
WorkflowSchema.methods.initializeSteps = function() {
    this.steps = [
        {
            stepNumber: 1,
            name: 'Create ServiceNow Ticket',
            description: 'Create and classify incident in ServiceNow',
            tool: 'servicenow',
            status: 'pending'
        },
        {
            stepNumber: 2,
            name: 'Send Slack Alert',
            description: 'Alert #incident-response channel',
            tool: 'slack',
            status: 'pending'
        },
        {
            stepNumber: 3,
            name: 'Gather Diagnostic Information',
            description: 'Collect commits, logs, and metrics from GitHub',
            tool: 'github',
            status: 'pending'
        },
        {
            stepNumber: 4,
            name: 'Analyze Root Cause',
            description: 'AI-powered root cause analysis using IBM watsonx',
            tool: 'watsonx',
            status: 'pending'
        },
        {
            stepNumber: 5,
            name: 'Create Confluence Page',
            description: 'Create incident documentation page',
            tool: 'confluence',
            status: 'pending'
        },
        {
            stepNumber: 6,
            name: 'Assign and Notify',
            description: 'Assign to team via Jira and notify via Slack',
            tool: 'jira',
            status: 'pending'
        },
        {
            stepNumber: 7,
            name: 'Monitor and Update',
            description: 'Set up monitoring and continuous updates',
            tool: 'system',
            status: 'pending'
        }
    ];
    return this;
};

// Method to update step status
WorkflowSchema.methods.updateStepStatus = function(stepNumber, status, result = null) {
    const step = this.steps.find(s => s.stepNumber === stepNumber);
    if (step) {
        step.status = status;
        
        if (status === 'running') {
            step.startedAt = new Date();
        } else if (status === 'completed' || status === 'failed') {
            step.completedAt = new Date();
            if (step.startedAt) {
                step.duration = step.completedAt - step.startedAt;
            }
        }
        
        if (result) {
            step.result = result;
        }
        
        // Update counters
        this.completedSteps = this.steps.filter(s => s.status === 'completed').length;
        this.failedSteps = this.steps.filter(s => s.status === 'failed').length;
        
        // Update workflow status
        if (this.completedSteps === this.steps.length) {
            this.status = 'completed';
            this.completedAt = new Date();
            this.totalDuration = this.completedAt - this.startedAt;
        } else if (status === 'failed') {
            this.lastError = {
                step: stepNumber,
                message: result?.error || 'Step failed',
                timestamp: new Date()
            };
        }
    }
    return this;
};

// Static method to get active workflows
WorkflowSchema.statics.getActiveWorkflows = function() {
    return this.find({ status: { $in: ['pending', 'running'] } })
        .populate('incidentId')
        .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Workflow', WorkflowSchema);
