const express = require('express');
const Prospect = require('../models/Prospect');
const { authenticateJWT, authorize, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /prospects - list all prospects with filters and pagination
router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (search && String(search).trim()) {
      const q = escapeRegex(String(search).trim());
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
        { message: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);
    
    const sortField = String(req.query.sort || 'createdAt').trim();
    const orderRaw = String(req.query.order || 'desc').toLowerCase();
    const dir = orderRaw === 'asc' ? 1 : -1;
    const sort = { [sortField]: dir };

    const [items, total] = await Promise.all([
      Prospect.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Prospect.countDocuments(filter),
    ]);

    res.json({
      items,
      page: parseInt(page),
      pages: Math.ceil(total / parsedLimit),
      total,
    });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// PUT /prospects/:id - update a prospect's status
router.put('/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'contacted', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const prospect = await Prospect.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!prospect) {
      return res.status(404).json({ message: 'Prospect not found' });
    }

    emitAudit(req, {
      action: 'update_prospect_status',
      targetType: 'prospect',
      targetId: prospect._id,
      details: { status },
    });

    res.json(prospect);
  } catch (err) {
    sendRouteError(res, err);
  }
});

module.exports = router;
