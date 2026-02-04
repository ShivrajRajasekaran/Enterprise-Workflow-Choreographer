/**
 * Incident Controller
 * Business logic for incident management
 */

const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const logger = require('../utils/logger');
const workflowService = require('../services/workflow.service');

// In-memory store fallback
let memoryIncidents = [];
let memoryCounter = 0;

// Helper to check DB status
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Get all incidents with filters and pagination
 */
exports.getAllIncidents = async (req, res, next) => {
    try {
        const { status, severity, page = 1, limit = 20 } = req.query;

        let incidentsData = [];
        let total = 0;

        if (isDbConnected()) {
            const query = {};
            if (status) query.status = status;
            if (severity) query.severity = severity;

            total = await Incident.countDocuments(query);
            incidentsData = await Incident.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
        } else {
            // Fallback to memory
            let filtered = [...memoryIncidents];
            if (status) filtered = filtered.filter(i => i.status === status);
            if (severity) filtered = filtered.filter(i => i.severity === severity);

            // Sort
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            total = filtered.length;
            const start = (page - 1) * limit;
            incidentsData = filtered.slice(start, start + parseInt(limit));
        }

        res.json({
            success: true,
            data: incidentsData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit) || 0
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get incident statistics
 */
exports.getIncidentStats = async (req, res, next) => {
    try {
        let stats = {};

        if (isDbConnected()) {
            const total = await Incident.countDocuments();
            const bySeverity = {
                critical: await Incident.countDocuments({ severity: 'critical', status: { $ne: 'closed' } }),
                high: await Incident.countDocuments({ severity: 'high', status: { $ne: 'closed' } }),
                medium: await Incident.countDocuments({ severity: 'medium', status: { $ne: 'closed' } }),
                low: await Incident.countDocuments({ severity: 'low', status: { $ne: 'closed' } })
            };
            const byStatus = {
                open: await Incident.countDocuments({ status: 'open' }),
                in_progress: await Incident.countDocuments({ status: 'in_progress' }),
                resolved: await Incident.countDocuments({ status: 'resolved' }),
                closed: await Incident.countDocuments({ status: 'closed' })
            };
            // Average time aggregation
            const avgTimeResult = await Incident.aggregate([
                { $match: { timeToResolve: { $exists: true, $ne: null } } },
                { $group: { _id: null, avgTime: { $avg: '$timeToResolve' } } }
            ]);

            stats = { total, bySeverity, byStatus, averageTimeToResolve: avgTimeResult[0]?.avgTime || 0 };
        } else {
            // Memory stats
            stats = {
                total: memoryIncidents.length,
                bySeverity: {
                    critical: memoryIncidents.filter(i => i.severity === 'critical' && i.status !== 'closed').length,
                    high: memoryIncidents.filter(i => i.severity === 'high' && i.status !== 'closed').length,
                    medium: memoryIncidents.filter(i => i.severity === 'medium' && i.status !== 'closed').length,
                    low: memoryIncidents.filter(i => i.severity === 'low' && i.status !== 'closed').length
                },
                byStatus: {
                    open: memoryIncidents.filter(i => i.status === 'open').length,
                    in_progress: memoryIncidents.filter(i => i.status === 'in_progress').length,
                    resolved: memoryIncidents.filter(i => i.status === 'resolved').length,
                    closed: memoryIncidents.filter(i => i.status === 'closed').length
                },
                averageTimeToResolve: 0 // Simplified
            };
        }

        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

/**
 * Get incident by ID
 */
exports.getIncidentById = async (req, res, next) => {
    try {
        let incident;
        const id = req.params.id;

        if (isDbConnected()) {
            if (id.match(/^[0-9a-fA-F]{24}$/)) {
                incident = await Incident.findById(id);
            } else {
                incident = await Incident.findOne({ _id: id }).collation({ locale: 'en', strength: 2 }).catch(() => null);
                if (!incident) incident = await Incident.findOne({ id: id });
            }
        } else {
            incident = memoryIncidents.find(i => i.id === id || i._id === id);
        }

        if (!incident) {
            return res.status(404).json({
                success: false,
                error: 'Incident not found'
            });
        }

        res.json({ success: true, data: incident });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new incident
 */
exports.createIncident = async (req, res, next) => {
    try {
        const { title, description, severity, category, affectedServices, tags, source } = req.body;
        let incident;

        if (isDbConnected()) {
            // Generate ID based on DB count
            const lastIncident = await Incident.findOne().sort({ createdAt: -1 });
            let nextIdNum = 1;
            if (lastIncident && lastIncident.id && lastIncident.id.startsWith('INC-')) {
                const parts = lastIncident.id.split('-');
                if (parts.length === 2 && !isNaN(parts[1])) nextIdNum = parseInt(parts[1]) + 1;
            }
            const newId = `INC-${String(nextIdNum).padStart(5, '0')}`;

            incident = await Incident.create({
                id: newId,
                title, description, severity: severity || 'medium', category: category || 'unknown',
                status: 'open', source: source || 'manual', reporter: req.body.reporter || 'API',
                affectedServices: affectedServices || [], tags: tags || [],
                detectedAt: new Date(), workflowStatus: 'pending'
            });
        } else {
            memoryCounter++;
            incident = {
                id: `INC-${String(memoryCounter).padStart(5, '0')}`,
                _id: `${Date.now()}`,
                title, description, severity: severity || 'medium', category: category || 'unknown',
                status: 'open', source: source || 'manual', reporter: req.body.reporter || 'API',
                affectedServices: affectedServices || [], tags: tags || [],
                detectedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                workflowStatus: 'pending',
                aiAnalysis: null
            };
            memoryIncidents.unshift(incident);
        }

        logger.info(`Incident created: ${incident.id}`, { incident: incident.id, severity: incident.severity });

        const io = req.app.get('io');
        if (io) io.emit('incident:created', incident);

        res.status(201).json({
            success: true,
            data: incident,
            message: 'Incident created successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Trigger workflow for an incident
 */
exports.triggerWorkflow = async (req, res, next) => {
    try {
        const id = req.params.id;
        let incident;

        if (isDbConnected()) {
            incident = await Incident.findOne({ id }) || await Incident.findById(id);
        } else {
            incident = memoryIncidents.find(i => i.id === id || i._id === id);
        }

        if (!incident) {
            return res.status(404).json({ success: false, error: 'Incident not found' });
        }

        const io = req.app.get('io');
        const workflowResults = await workflowService.executeWorkflow(incident, io);

        if (isDbConnected()) {
            incident.workflowStatus = 'running';
            await incident.save();
        } else {
            incident.workflowStatus = 'running';
            incident.updatedAt = new Date().toISOString();
            // In-memory logic updates object reference directly, so workflowService updates are already applied to 'incident' object
        }

        res.json({
            success: true,
            data: { incident, workflowResults },
            message: 'Workflow triggered successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update an incident
 */
exports.updateIncident = async (req, res, next) => {
    try {
        const id = req.params.id;
        let incident;

        if (isDbConnected()) {
            incident = await Incident.findOne({ id }) || await Incident.findById(id);
        } else {
            incident = memoryIncidents.find(i => i.id === id || i._id === id);
        }

        if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

        const allowedUpdates = ['title', 'description', 'severity', 'status', 'category', 'affectedServices', 'tags', 'rootCauseHypothesis', 'aiAnalysis'];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                incident[field] = req.body[field];
            }
        });

        if (isDbConnected()) {
            await incident.save();
        } else {
            incident.updatedAt = new Date().toISOString();
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('incident:updated', incident);
            io.to(`incident:${incident.id}`).emit('incident:updated', incident);
        }

        res.json({ success: true, data: incident, message: 'Incident updated successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * Assign incident to a user
 */
exports.assignIncident = async (req, res, next) => {
    try {
        const id = req.params.id;
        let incident;
        if (isDbConnected()) {
            incident = await Incident.findOne({ id }) || await Incident.findById(id);
        } else {
            incident = memoryIncidents.find(i => i.id === id || i._id === id);
        }

        if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

        const { userId, name, email, slackId } = req.body;
        incident.assignedTo = { userId, name, email, slackId };
        incident.status = 'in_progress';

        if (isDbConnected()) await incident.save();
        else incident.updatedAt = new Date().toISOString();

        const io = req.app.get('io');
        if (io) io.emit('incident:assigned', incident);

        res.json({ success: true, data: incident, message: `Incident assigned to ${name}` });
    } catch (error) {
        next(error);
    }
};

/**
 * Resolve an incident
 */
exports.resolveIncident = async (req, res, next) => {
    try {
        const id = req.params.id;
        let incident;
        if (isDbConnected()) {
            incident = await Incident.findOne({ id }) || await Incident.findById(id);
        } else {
            incident = memoryIncidents.find(i => i.id === id || i._id === id);
        }

        if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

        incident.resolution = req.body.resolution;
        incident.status = 'resolved';

        if (isDbConnected()) await incident.save();
        else {
            incident.updatedAt = new Date().toISOString();
            incident.resolvedAt = new Date().toISOString();
        }

        const io = req.app.get('io');
        if (io) io.emit('incident:resolved', incident);

        res.json({ success: true, data: incident, message: 'Incident resolved successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete an incident
 */
exports.deleteIncident = async (req, res, next) => {
    try {
        const id = req.params.id;
        let result;

        if (isDbConnected()) {
            result = await Incident.findOneAndDelete({ id }) || await Incident.findByIdAndDelete(id);
        } else {
            const index = memoryIncidents.findIndex(i => i.id === id || i._id === id);
            if (index !== -1) {
                result = memoryIncidents.splice(index, 1)[0];
            }
        }

        if (!result) return res.status(404).json({ success: false, error: 'Incident not found' });

        res.json({ success: true, data: result, message: 'Incident deleted successfully' });
    } catch (error) {
        next(error);
    }
};
