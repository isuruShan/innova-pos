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
      // Superadmin Features
      { name: 'Dashboard / Platform Analytics', path: '/superadmin/dashboard', description: 'View system-wide sales, active trials, and platform stats', roles: ['superadmin'] },
      { name: 'Merchant Applications', path: '/applications', description: 'Review pending, approved, or rejected merchant requests', roles: ['superadmin'] },
      { name: 'Tenants Directory / Merchants', path: '/merchants', description: 'Manage active, suspended, or trial merchant accounts', roles: ['superadmin'] },
      { name: 'Prospects Directory', path: '/prospects', description: 'Manage potential merchant signups and prospects', roles: ['superadmin'] },
      { name: 'Suspended Activities', path: '/superadmin/suspended-activities', description: 'Review suspended merchants and restricted actions log', roles: ['superadmin'] },
      { name: 'Trial Banners & Marketing', path: '/superadmin/banners', description: 'Schedule and manage promotional banners for trial users', roles: ['superadmin'] },
      { name: 'Trial Conversion Analytics', path: '/superadmin/trial-merchants', description: 'Monitor trial merchants and conversion metrics', roles: ['superadmin'] },
      { name: 'Subscription Plans Settings', path: '/plans', description: 'Configure billing tiers, trial rules, and plan pricing', roles: ['superadmin'] },
      { name: 'Paid Add-ons definitions', path: '/paid-addons', description: 'Manage global definitions for platform feature upgrades', roles: ['superadmin'] },
      { name: 'Platform Payments Reconciliation', path: '/payments', description: 'Superadmin reconciliation of subscription payments', roles: ['superadmin'] },
      { name: 'Payment Provider Setup', path: '/payment-setup', description: 'Configure Stripe, PayPal, and gateway settings', roles: ['superadmin'] },
      { name: 'Uber Integration Settings', path: '/uber-setup', description: 'Configure platform-wide API credentials for Uber Eats', roles: ['superadmin'] },

      // Merchant Admin Features
      { name: 'Dashboard', path: '/dashboard', description: 'View business summary, recent orders, and daily sales performance', roles: ['merchant_admin'] },
      { name: 'Business Analytics', path: '/analytics', description: 'Detailed reports on sales, products, and order trends', roles: ['merchant_admin'] },
      { name: 'Orders List', path: '/orders', description: 'View, filter, search, and manage cashier and online orders', roles: ['merchant_admin'] },
      { name: 'Reports Portal', path: '/reports', description: 'Access Menu Mix, Order Distribution, Hourly Trends, Drawer Cash Sessions, and Returns reports', roles: ['merchant_admin'] },
      { name: 'Notifications Center', path: '/notifications', description: 'View and manage merchant announcements and alerts', roles: ['merchant_admin'] },
      { name: 'Branding & Store Settings', path: '/branding', description: 'Customize theme colors, logos, and receipt styles', roles: ['merchant_admin'] },
      { name: 'Users Management', path: '/users/active', description: 'Manage cashiers, managers, and administrative users', roles: ['merchant_admin'] },
      { name: 'Stores Locations Management', path: '/stores/active', description: 'Configure store details, registers, and operations', roles: ['merchant_admin'] },
      { name: 'Menu Items Management', path: '/menu', description: 'Add and edit products, combos, variants, and categories', roles: ['merchant_admin'] },
      { name: 'Inventory Levels', path: '/inventory', description: 'Track stock counts, item costs, and low stock warnings', roles: ['merchant_admin'] },
      { name: 'Suppliers Directory', path: '/suppliers', description: 'Manage supplier contacts, supply categories, and details', roles: ['merchant_admin'] },
      { name: 'Purchase Orders', path: '/purchase-orders', description: 'Draft, send, and track supplier purchase orders', roles: ['merchant_admin'] },
      { name: 'Goods Receipts', path: '/goods-receipts', description: 'Record and verify received stock inventory shipments', roles: ['merchant_admin'] },
      { name: 'Wastage Management', path: '/wastage', description: 'Log and track spoiled, expired, or wasted inventory items', roles: ['merchant_admin'] },
      { name: 'Inventory Sessions Audit', path: '/inventory-sessions', description: 'Review stocktake sessions and inventory adjustments', roles: ['merchant_admin'] },
      { name: 'Table Reservations', path: '/reservations', description: 'View booking diaries, guest lists, and reservation statuses', roles: ['merchant_admin'] },
      { name: 'Floor Plan Editor', path: '/floor-plan/editor', description: 'Design table layouts, rooms, and seating plans', roles: ['merchant_admin'] },
      { name: 'Floor Plan View', path: '/floor-plan', description: 'Interactive table status layout and reservation view', roles: ['merchant_admin'] },
      { name: 'Table Seating Analytics', path: '/table-analytics', description: 'Track table occupancy, turn times, and guest cover stats', roles: ['merchant_admin'] },
      { name: 'Loyalty Program Tiers', path: '/loyalty/program', description: 'Setup customer loyalty points, member tiers, and milestones', roles: ['merchant_admin'] },
      { name: 'Loyalty Rewards Catalog', path: '/loyalty/rewards', description: 'Manage points redemption catalog and reward items', roles: ['merchant_admin'] },
      { name: 'Customers Directory', path: '/customers', description: 'View customer contact cards, notes, and loyalty profiles', roles: ['merchant_admin'] },
      { name: 'Promotions / Discounts', path: '/promotions', description: 'Manage marketing discounts, BOGO deals, and promo campaigns', roles: ['merchant_admin'] },
      { name: 'Accounting Chart of Accounts', path: '/accounting/coa', description: 'Define business ledger accounts, assets, and liabilities', roles: ['merchant_admin'] },
      { name: 'Accounting General Ledger', path: '/accounting/ledger', description: 'Review double-entry journal postings and transaction logs', roles: ['merchant_admin'] },
      { name: 'Accounting Contacts', path: '/accounting/contacts', description: 'Manage financial profiles for vendors and buyers', roles: ['merchant_admin'] },
      { name: 'Accounting Payroll', path: '/accounting/payroll', description: 'Track employee wages, schedules, and payroll ledger entries', roles: ['merchant_admin'] },
      { name: 'Accounting Financial Reports', path: '/accounting/reports', description: 'View Profit & Loss statements, Balance Sheets, and Tax reports', roles: ['merchant_admin'] },
      { name: 'Commissions & Channel Sales', path: '/foodmarket-commissions', description: 'Track aggregator fees, commissions, and net channel sales', roles: ['merchant_admin'] },
      { name: 'Cashier Drawer Sessions', path: '/cashier-sessions', description: 'View registers opening/closing balances and cash drops', roles: ['merchant_admin'] },
      { name: 'Foodmarket Partners', path: '/foodmarket-partners', description: 'Configure Uber Eats, food aggregators, and custom delivery networks', roles: ['merchant_admin'] },
      { name: 'Add-ons Marketplace', path: '/addons', description: 'Subscribe to WhatsApp, Accounting, or Loyalty feature add-ons', roles: ['merchant_admin'] },
      { name: 'Uber Eats Integration Config', path: '/uber-config', description: 'Map menu items and synchronize store with Uber Eats API', roles: ['merchant_admin'] },
      { name: 'WhatsApp Marketing Config', path: '/whatsapp-config', description: 'Configure automated booking confirmations and digital receipt messages', roles: ['merchant_admin'] },
      { name: 'Subscription Overview', path: '/subscription/overview', description: 'Check subscription tier, billing period, and renewal dates', roles: ['merchant_admin'] },
      { name: 'Subscription Breakdown', path: '/subscription/breakdown', description: 'Review store license limits, extra cashiers, and add-on costs', roles: ['merchant_admin'] },
      { name: 'Subscription Payment History', path: '/subscription/payments', description: 'Download billing invoices and view receipt logs', roles: ['merchant_admin'] },
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
