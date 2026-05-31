const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const Tenant = require('../models/Tenant');
const MerchantApplication = require('../models/MerchantApplication');
const Promotion = require('../models/Promotion');
const LoyaltyReward = require('../models/LoyaltyReward');
const Order = require('../models/Order');
const Store = require('../models/Store');
const User = require('../models/User');
const Customer = require('../models/Customer');
const FoodmarketPartner = require('../models/FoodmarketPartner');
const Subscription = require('../models/Subscription');
const Inventory = require('../models/Inventory');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.json({
        navigation: [],
        tenants: [],
        applications: [],
        promotions: [],
        rewards: [],
        orders: [],
        stores: [],
        users: [],
        customers: [],
        foodmarketPartners: [],
        subscriptions: [],
        inventory: [],
      });
    }

    const regex = new RegExp(query, 'i');
    const isSuperAdmin = req.user.role === 'superadmin';

    const allNavigationFeatures = [
      { name: 'Dashboard / Analytics', path: '/admin/analytics', description: 'View system-wide sales, active trials, and platform stats', roles: ['superadmin'] },
      { name: 'Merchant Applications', path: '/admin/applications', description: 'Review pending, approved, or rejected merchant requests', roles: ['superadmin'] },
      { name: 'Tenants Directory', path: '/admin/tenants', description: 'Manage active, suspended, or trial merchant accounts', roles: ['superadmin'] },
      { name: 'Subscription Plans', path: '/admin/plans', description: 'Configure billing tiers, trial rules, and plan pricing', roles: ['superadmin'] },
      { name: 'Paid Add-ons', path: '/admin/addons', description: 'Manage global definitions for feature upgrades', roles: ['superadmin'] },
      { name: 'Platform Payments', path: '/admin/payments', description: 'Superadmin reconciliation of subscription payments', roles: ['superadmin'] },
      { name: 'Uber Integration Settings', path: '/admin/uber', description: 'Configure platform-wide API credentials for Uber Eats', roles: ['superadmin'] },
      { name: 'Stores Management', path: '/admin/stores', description: 'Add, edit, or configure store locations and settings', roles: ['merchant_admin'] },
      { name: 'Foodmarket Partners', path: '/admin/foodmarket-partners', description: 'Configure delivery integrations, commissions, and overrides', roles: ['merchant_admin'] },
      { name: 'Commissions & Sales Reports', path: '/admin/commissions', description: 'View channel revenues, commission costs, and order histories', roles: ['merchant_admin'] },
      { name: 'Promotions / Discounts', path: '/admin/promotions', description: 'Manage marketing discounts, BOGO deals, and promo campaigns', roles: ['merchant_admin'] },
      { name: 'Loyalty Rewards Program', path: '/admin/loyalty', description: 'Setup reward redemptions, member perks, and point tiers', roles: ['merchant_admin'] },
      { name: 'Customers Directory', path: '/admin/customers', description: 'View loyalty profiles, member tier levels, and transaction histories', roles: ['merchant_admin'] },
    ];

    const matchedNavigation = allNavigationFeatures.filter(
      (item) =>
        item.roles.includes(req.user.role) &&
        (item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()))
    );

    if (isSuperAdmin) {
      const [tenants, applications, users, subscriptions] = await Promise.all([
        Tenant.find({
          $or: [
            { businessName: regex },
            { slug: regex }
          ]
        })
          .select('businessName slug status subscriptionStatus trialEndsAt')
          .limit(10)
          .lean(),
        MerchantApplication.find({
          $or: [
            { 'business.name': regex },
            { 'personal.name': regex },
            { 'personal.email': regex }
          ]
        })
          .select('business.name personal.name personal.email status')
          .limit(10)
          .lean(),
        User.find({
          $or: [
            { name: regex },
            { email: regex }
          ]
        })
          .select('name email role isActive')
          .limit(10)
          .lean(),
        Subscription.find({
          $or: [
            { planCode: regex },
            { plan: regex }
          ]
        })
          .populate('tenantId', 'businessName')
          .limit(10)
          .lean(),
      ]);

      return res.json({
        navigation: matchedNavigation,
        tenants,
        applications,
        users,
        subscriptions,
        promotions: [],
        rewards: [],
        orders: [],
        stores: [],
        customers: [],
        foodmarketPartners: [],
        inventory: [],
      });
    } else {
      const tenantId = req.user.tenantId || req.headers['x-tenant-id'] || req.tenantId;
      if (!tenantId) {
        return res.json({
          navigation: matchedNavigation,
          tenants: [],
          applications: [],
          promotions: [],
          rewards: [],
          orders: [],
          stores: [],
          users: [],
          customers: [],
          foodmarketPartners: [],
          subscriptions: [],
          inventory: [],
        });
      }

      const orderFilter = { tenantId };
      if (!isNaN(Number(query))) {
        orderFilter.orderNumber = Number(query);
      } else {
        orderFilter.$or = [
          { 'customer.name': regex },
          { 'customer.phone': regex }
        ];
      }

      const [promotions, rewards, orders, stores, users, customers, foodmarketPartners, subscriptions, inventory] = await Promise.all([
        Promotion.find({ tenantId, name: regex })
          .select('name type active approvalStatus')
          .limit(10)
          .lean(),
        LoyaltyReward.find({ tenantId, name: regex })
          .select('name rewardType active pointsCost')
          .limit(10)
          .lean(),
        Order.find(orderFilter)
          .select('orderNumber customer totalAmount status createdAt')
          .limit(10)
          .lean(),
        Store.find({ tenantId, name: regex })
          .select('name code phone isActive')
          .limit(10)
          .lean(),
        User.find({ tenantId, $or: [{ name: regex }, { email: regex }] })
          .select('name email role isActive')
          .limit(10)
          .lean(),
        Customer.find({ tenantId, $or: [{ name: regex }, { email: regex }, { mobile: regex }] })
          .select('name email mobile')
          .limit(10)
          .lean(),
        FoodmarketPartner.find({ tenantId, name: regex })
          .select('name commissionType commissionPercentage commissionFlat isActive')
          .limit(10)
          .lean(),
        Subscription.find({ tenantId, $or: [{ planCode: regex }, { plan: regex }] })
          .select('plan planCode amount currency endDate')
          .limit(10)
          .lean(),
        Inventory.find({ tenantId, itemName: regex })
          .select('itemName quantity unit costPerUnit minThreshold')
          .limit(10)
          .lean(),
      ]);

      return res.json({
        navigation: matchedNavigation,
        tenants: [],
        applications: [],
        promotions,
        rewards,
        orders,
        stores,
        users,
        customers,
        foodmarketPartners,
        subscriptions,
        inventory,
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
