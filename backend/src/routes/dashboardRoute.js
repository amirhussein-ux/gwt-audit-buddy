const express = require('express');
const { authenticate } = require('../middleware/auth');
const Agency = require('../models/Agency');
const ComplianceScore = require('../models/ComplianceScore');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

/**
 * GET /dashboard/maturity-index
 * Returns all agencies with their latest compliance scores
 * Used for the main Maturity Index radar chart
 */
router.get('/maturity-index', authenticate, async (req, res) => {
  try {
    const agencies = await Agency.find({ isActive: true }).lean();

    // Get latest compliance score for each agency
    const agenciesWithScores = await Promise.all(
      agencies.map(async (agency) => {
        const latestScore = await ComplianceScore.findOne({ agency: agency._id })
          .sort({ createdAt: -1 })
          .lean();

        return {
          ...agency,
          latestScore: latestScore || null,
        };
      })
    );

    return res.status(200).json({
      agencies: agenciesWithScores,
      total: agenciesWithScores.length,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[Dashboard] Maturity index error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch maturity index',
    });
  }
});

/**
 * GET /dashboard/compliance-trend
 * Returns historical compliance scores for trend analysis
 * Query params: ?agencyId=X&days=30
 */
router.get('/compliance-trend', authenticate, async (req, res) => {
  try {
    const { agencyId, days = 90 } = req.query;

    const dateFilter = {
      createdAt: {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      },
    };

    let query = { ...dateFilter };
    if (agencyId) {
      query.agency = agencyId;
    }

    const scores = await ComplianceScore.find(query)
      .select('agency overallScore webPresence webUsability createdAt')
      .sort({ createdAt: 1 })
      .lean();

    // Group by agency if not filtered
    if (!agencyId) {
      const grouped = {};
      scores.forEach((score) => {
        const agencyIdStr = score.agency.toString();
        if (!grouped[agencyIdStr]) {
          grouped[agencyIdStr] = [];
        }
        grouped[agencyIdStr].push(score);
      });

      return res.status(200).json({
        data: grouped,
        period: `Last ${days} days`,
      });
    }

    return res.status(200).json({
      data: scores,
      agencyId,
      period: `Last ${days} days`,
    });
  } catch (error) {
    console.error('[Dashboard] Compliance trend error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch compliance trend',
    });
  }
});

/**
 * GET /dashboard/leaderboard
 * Returns top N agencies by compliance score
 * Query params: ?limit=10
 */
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await ComplianceScore.find()
      .sort({ overallScore: -1, createdAt: -1 })
      .limit(Number(limit))
      .populate('agency', 'name acronym agencyType region domainUrl')
      .lean();

    // Remove duplicates (keep highest score per agency)
    const seenAgencies = new Set();
    const unique = leaderboard.filter((score) => {
      const agencyId = score.agency._id.toString();
      if (seenAgencies.has(agencyId)) {
        return false;
      }
      seenAgencies.add(agencyId);
      return true;
    });

    // Add rank
    const ranked = unique.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return res.status(200).json({
      leaderboard: ranked,
      count: ranked.length,
    });
  } catch (error) {
    console.error('[Dashboard] Leaderboard error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch leaderboard',
    });
  }
});

/**
 * GET /dashboard/critical-alerts
 * Returns agencies with critical compliance issues
 * Focus: Missing PST, Transparency Seals, Low accessibility
 */
router.get('/critical-alerts', authenticate, async (req, res) => {
  try {
    // Get agencies with critical issues
    const alerts = await ComplianceScore.find({
      'criticalIssues.severity': { $in: ['critical', 'high'] },
    })
      .select('agency overallScore complianceStatus criticalIssues auditedAt')
      .populate('agency', 'name acronym domainUrl region')
      .sort({ auditedAt: -1 })
      .lean();

    // Also include agencies missing basic audit data
    const recentAudits = await AuditLog.find()
      .select('agency pst transparencySeal')
      .sort({ createdAt: -1 })
      .lean();

    const missingPSTAlerts = [];
    const missingTransparencyAlerts = [];

    recentAudits.forEach((audit) => {
      if (!audit.pst?.found) {
        missingPSTAlerts.push({
          agency: audit.agency,
          type: 'missing_pst',
          severity: 'high',
        });
      }
      if (!audit.transparencySeal?.found) {
        missingTransparencyAlerts.push({
          agency: audit.agency,
          type: 'missing_transparency_seal',
          severity: 'high',
        });
      }
    });

    // Combine and deduplicate
    const allAlerts = [
      ...alerts,
      ...missingPSTAlerts.slice(0, 5),
      ...missingTransparencyAlerts.slice(0, 5),
    ];

    const uniqueAlerts = [];
    const seenAgencies = new Set();

    allAlerts.forEach((alert) => {
      const agencyId = alert.agency.toString();
      if (!seenAgencies.has(agencyId)) {
        seenAgencies.add(agencyId);
        uniqueAlerts.push(alert);
      }
    });

    return res.status(200).json({
      alerts: uniqueAlerts.slice(0, 20),
      total: uniqueAlerts.length,
    });
  } catch (error) {
    console.error('[Dashboard] Critical alerts error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch critical alerts',
    });
  }
});

/**
 * GET /dashboard/summary
 * Returns all dashboard data in a single request
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const [mIndex, lboard, alerts, stats] = await Promise.all([
      Agency.countDocuments({ isActive: true }),
      ComplianceScore.find()
        .select('overallScore')
        .lean()
        .then((scores) => {
          const avg = scores.length > 0 ? scores.reduce((a, b) => a + b.overallScore, 0) / scores.length : 0;
          return {
            averageCompliance: avg.toFixed(2),
            totalAudits: scores.length,
          };
        }),
      AuditLog.countDocuments(),
      ComplianceScore.find()
        .select('complianceStatus')
        .lean()
        .then((scores) => {
          return {
            excellent: scores.filter((s) => s.complianceStatus === 'excellent').length,
            good: scores.filter((s) => s.complianceStatus === 'good').length,
            fair: scores.filter((s) => s.complianceStatus === 'fair').length,
            poor: scores.filter((s) => s.complianceStatus === 'poor').length,
            critical: scores.filter((s) => s.complianceStatus === 'critical').length,
          };
        }),
    ]);

    return res.status(200).json({
      totalAgencies: mIndex,
      averageCompliance: lboard.averageCompliance,
      totalAudits: lboard.totalAudits,
      statusDistribution: stats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[Dashboard] Summary error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch dashboard summary',
    });
  }
});

module.exports = router;
