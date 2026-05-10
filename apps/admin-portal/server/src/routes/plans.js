const express = require('express');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Tenant = require('../models/Tenant');
const { authenticateJWT, authorize, emitAudit } = require('@innovapos/shared-middleware');
const { tenantPlanAudience } = require('../utils/planAudience');

const router = express.Router();

function normalizeFeatureLines(body) {
  if (body.featureLines === undefined) return undefined;
  if (!Array.isArray(body.featureLines)) return [];
  return body.featureLines.map((s) => String(s).trim()).filter(Boolean);
}

function clampAngle(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(360, Math.max(0, Math.round(n)));
}

function normalizeHex(input, fallback) {
  if (typeof input !== 'string') return fallback;
  const s = input.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function appearanceForCreate(body) {
  return {
    planTagShow: Boolean(body.planTagShow),
    planTagText: String(body.planTagText || '').trim(),
    planTagTextColor: normalizeHex(body.planTagTextColor, '#ffffff'),
    planTagBgMode: body.planTagBgMode === 'gradient' ? 'gradient' : 'solid',
    planTagSolidColor: normalizeHex(body.planTagSolidColor, '#fa7237'),
    planTagGradFrom: normalizeHex(body.planTagGradFrom, '#fa7237'),
    planTagGradTo: normalizeHex(body.planTagGradTo, '#233d4d'),
    planTagGradAngle: clampAngle(body.planTagGradAngle, 135),
    planCardBgMode: ['default', 'solid', 'gradient'].includes(body.planCardBgMode)
      ? body.planCardBgMode
      : 'default',
    planCardSolidColor: normalizeHex(body.planCardSolidColor, '#ffffff'),
    planCardGradFrom: normalizeHex(body.planCardGradFrom, '#ffffff'),
    planCardGradTo: normalizeHex(body.planCardGradTo, '#f1f5f9'),
    planCardGradAngle: clampAngle(body.planCardGradAngle, 145),
    planCardUseLightText: Boolean(body.planCardUseLightText),
  };
}

function patchAppearance(plan, body) {
  if (body.planTagShow !== undefined) plan.planTagShow = Boolean(body.planTagShow);
  if (body.planTagText !== undefined) plan.planTagText = String(body.planTagText).trim();
  if (body.planTagTextColor !== undefined) plan.planTagTextColor = normalizeHex(body.planTagTextColor, plan.planTagTextColor);
  if (body.planTagBgMode !== undefined) plan.planTagBgMode = body.planTagBgMode === 'gradient' ? 'gradient' : 'solid';
  if (body.planTagSolidColor !== undefined) plan.planTagSolidColor = normalizeHex(body.planTagSolidColor, plan.planTagSolidColor);
  if (body.planTagGradFrom !== undefined) plan.planTagGradFrom = normalizeHex(body.planTagGradFrom, plan.planTagGradFrom);
  if (body.planTagGradTo !== undefined) plan.planTagGradTo = normalizeHex(body.planTagGradTo, plan.planTagGradTo);
  if (body.planTagGradAngle !== undefined) plan.planTagGradAngle = clampAngle(body.planTagGradAngle, plan.planTagGradAngle);
  if (body.planCardBgMode !== undefined) {
    plan.planCardBgMode = ['default', 'solid', 'gradient'].includes(body.planCardBgMode)
      ? body.planCardBgMode
      : 'default';
  }
  if (body.planCardSolidColor !== undefined) plan.planCardSolidColor = normalizeHex(body.planCardSolidColor, plan.planCardSolidColor);
  if (body.planCardGradFrom !== undefined) plan.planCardGradFrom = normalizeHex(body.planCardGradFrom, plan.planCardGradFrom);
  if (body.planCardGradTo !== undefined) plan.planCardGradTo = normalizeHex(body.planCardGradTo, plan.planCardGradTo);
  if (body.planCardGradAngle !== undefined) plan.planCardGradAngle = clampAngle(body.planCardGradAngle, plan.planCardGradAngle);
  if (body.planCardUseLightText !== undefined) plan.planCardUseLightText = Boolean(body.planCardUseLightText);
}

// GET /plans/for-subscription — merchant portal: plans for this tenant's region only
router.get('/for-subscription', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).select('countryIso').lean();
    const audience = tenantPlanAudience(tenant?.countryIso);
    const plans = await SubscriptionPlan.find({ isActive: true, isPublic: true, planAudience: audience })
      .sort({ isDefault: -1, durationDays: 1, createdAt: 1 })
      .lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /plans/public — optional regional filter (?audience=local|international)
router.get('/public', async (req, res) => {
  try {
    const filter = { isActive: true, isPublic: true };
    const a = req.query.audience;
    if (a === 'local' || a === 'international') filter.planAudience = a;
    const plans = await SubscriptionPlan.find(filter)
      .sort({ isDefault: -1, durationDays: 1, createdAt: 1 })
      .lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /plans — superadmin list (default: enabled only)
// ?status=active (default) | inactive | disabled | all — inactive/disabled are synonyms (isActive false)
router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const raw = String(req.query.status ?? 'active').toLowerCase();
    const filter = {};
    if (raw === 'all') {
      /* show every plan */
    } else if (raw === 'inactive' || raw === 'disabled') {
      filter.isActive = false;
    } else {
      filter.isActive = true;
    }
    const plans = await SubscriptionPlan.find(filter).sort({ isDefault: -1, createdAt: -1 }).lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /plans — create plan
router.post('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { name, code, billingCycle, amount, currency, durationDays, description, isPublic, isActive, isDefault, planAudience } = req.body;
    if (!name?.trim() || !code?.trim() || !billingCycle || amount === undefined || !durationDays) {
      return res.status(400).json({ message: 'name, code, billingCycle, amount, and durationDays are required' });
    }
    const normalizedCode = code.trim().toUpperCase();
    const exists = await SubscriptionPlan.findOne({ code: normalizedCode });
    if (exists) return res.status(400).json({ message: 'Plan code already exists' });

    if (isDefault) {
      await SubscriptionPlan.updateMany({ isDefault: true }, { $set: { isDefault: false, updatedBy: req.user.id } });
    }

    const linesOpt = normalizeFeatureLines(req.body);
    const descTrim = (description || '').trim();
    const resolvedLines =
      linesOpt !== undefined ? linesOpt : descTrim.split('\n').map((s) => s.trim()).filter(Boolean);

    const audience =
      planAudience === 'international' ? 'international' : 'local';

    const plan = await SubscriptionPlan.create({
      name: name.trim(),
      code: normalizedCode,
      billingCycle,
      amount: Number(amount),
      currency: (currency || 'LKR').toUpperCase().trim(),
      durationDays: Number(durationDays),
      description: resolvedLines.join('\n'),
      featureLines: resolvedLines,
      planAudience: audience,
      isPublic: isPublic !== false,
      isActive: isActive !== false,
      isDefault: Boolean(isDefault),
      ...appearanceForCreate(req.body),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await emitAudit({
      req,
      action: 'PLAN_CREATED',
      resource: 'SubscriptionPlan',
      resourceId: plan._id,
      changes: { after: plan.toObject() },
    });

    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /plans/:id — update plan
router.put('/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const fields = ['name', 'billingCycle', 'amount', 'currency', 'durationDays', 'description', 'isPublic', 'isActive', 'isDefault', 'code'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (f === 'name' || f === 'description') plan[f] = String(req.body[f]).trim();
        else if (f === 'code') plan[f] = String(req.body[f]).trim().toUpperCase();
        else if (f === 'currency') plan[f] = String(req.body[f]).trim().toUpperCase();
        else if (f === 'amount' || f === 'durationDays') plan[f] = Number(req.body[f]);
        else plan[f] = req.body[f];
      }
    });

    const linesOpt = normalizeFeatureLines(req.body);
    if (linesOpt !== undefined) {
      plan.featureLines = linesOpt;
      plan.description = linesOpt.join('\n');
    }

    if (req.body.planAudience !== undefined) {
      plan.planAudience = req.body.planAudience === 'international' ? 'international' : 'local';
    }

    patchAppearance(plan, req.body);

    plan.updatedBy = req.user.id;

    if (plan.isDefault) {
      await SubscriptionPlan.updateMany({ _id: { $ne: plan._id }, isDefault: true }, { $set: { isDefault: false, updatedBy: req.user.id } });
    }

    await plan.save();
    await emitAudit({
      req,
      action: 'PLAN_UPDATED',
      resource: 'SubscriptionPlan',
      resourceId: plan._id,
      changes: { after: plan.toObject() },
    });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /plans/:id — soft disable
router.delete('/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    if (plan.isDefault) {
      return res.status(400).json({ message: 'Default plan cannot be deleted. Set another default first.' });
    }
    plan.isActive = false;
    plan.updatedBy = req.user.id;
    await plan.save();
    await emitAudit({
      req,
      action: 'PLAN_DEACTIVATED',
      resource: 'SubscriptionPlan',
      resourceId: plan._id,
      changes: { after: { isActive: false } },
    });
    res.json({ message: 'Plan deactivated', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
