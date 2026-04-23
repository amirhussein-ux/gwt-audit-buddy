const express = require('express');
const { authenticate } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

// Configuration
const NOTIFICATION_CONFIG = {
  PAGINATION_DEFAULTS: { skip: 0, limit: 50 },
};

/**
 * GET /notifications/recent
 * Get recent notifications for current user
 */
router.get('/recent', authenticate, async (req, res) => {
  try {
    const { skip = NOTIFICATION_CONFIG.PAGINATION_DEFAULTS.skip, limit = NOTIFICATION_CONFIG.PAGINATION_DEFAULTS.limit } = req.query;

    // Get notifications visible to this user's role
    const query = { scope: 'all_users' };

    const notifications = await Notification.find(query)
      .populate('auditLog', 'auditUrl status')
      .populate('triggeredBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);

    return res.status(200).json({
      notifications,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('[Notifications Recent] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch notifications',
    });
  }
});

/**
 * GET /notifications/unread
 * Get unread notifications count for current user
 */
router.get('/unread', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    // Count notifications where current user is NOT in the readBy array
    const count = await Notification.countDocuments({
      scope: 'all_users',
      readBy: { $ne: userId }
    });

    return res.status(200).json({
      unreadCount: count,
    });
  } catch (error) {
    console.error('[Notifications Unread] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch unread count',
    });
  }
});

/**
 * GET /notifications/by-type/:type
 * Get notifications filtered by type
 */
router.get('/by-type/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const { skip = NOTIFICATION_CONFIG.PAGINATION_DEFAULTS.skip, limit = NOTIFICATION_CONFIG.PAGINATION_DEFAULTS.limit } = req.query;

    const validTypes = ['audit_completed', 'audit_cancelled', 'audit_failed', 'audit_archived', 'audit_restored'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid notification type',
      });
    }

    const query = { type, scope: 'all_users' };

    const notifications = await Notification.find(query)
      .populate('auditLog', 'auditUrl status')
      .populate('triggeredBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);

    return res.status(200).json({
      notifications,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('[Notifications By Type] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch notifications',
    });
  }
});

/**
 * PUT /notifications/:id/read
 * Mark notification as read for current user (per-user tracking)
 */
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { $addToSet: { readBy: userId } },  // Add user to readBy array (no duplicates)
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('[Notifications Mark Read] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to update notification',
    });
  }
});

/**
 * PUT /notifications/mark-all-read
 * Mark all notifications as read for current user only (per-user)
 */
router.put('/mark-all-read', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Add current user to readBy array for all unread notifications (where user is not already in readBy)
    const result = await Notification.updateMany(
      { scope: 'all_users', readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    return res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('[Notifications Mark All Read] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to update notifications',
    });
  }
});

/**
 * GET /notifications/stats
 * Get notification statistics for current user
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const stats = await Notification.aggregate([
      { $match: { scope: 'all_users' } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    // Count unread for current user (not in readBy array)
    const unreadCount = await Notification.countDocuments({
      isRead: false,
      scope: 'all_users',
      readBy: { $ne: userId }
    });
    
    const totalCount = await Notification.countDocuments({ scope: 'all_users' });

    return res.status(200).json({
      stats,
      unreadCount,
      totalCount,
    });
  } catch (error) {
    console.error('[Notifications Stats] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch notification stats',
    });
  }
});

module.exports = router;
