'use strict';

const axios = require('axios');
const Tenant = require('../models/Tenant');
const PlatformUberSettings = require('../models/PlatformUberSettings');
const { encrypt, decrypt } = require('../utils/encryption');

const UBER_TOKEN_URL = 'https://login.uber.com/oauth/v2/token';

/**
 * Exchange OAuth callback code for access and refresh tokens
 * @param {string} tenantId
 * @param {string} storeId
 * @param {string} code
 * @returns {Promise<object>} connected store config
 */
async function exchangeCodeForStoreToken(tenantId, storeId, code) {
  // 1. Fetch platform developer credentials
  const platformSettings = await PlatformUberSettings.findOne({ singletonKey: 'default' }).select('+clientSecret').lean();
  if (!platformSettings || !platformSettings.clientId || !platformSettings.clientSecret) {
    throw new Error('Platform Uber developer credentials are not configured.');
  }

  const decryptedClientSecret = decrypt(platformSettings.clientSecret);
  const redirectUri = platformSettings.redirectUri;

  // 2. Exchange authorization code for access token
  const response = await axios.post(
    UBER_TOKEN_URL,
    new URLSearchParams({
      client_id: platformSettings.clientId,
      client_secret: decryptedClientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const { access_token, refresh_token, expires_in } = response.data;
  if (!access_token) {
    throw new Error('Failed to acquire access token from Uber Eats.');
  }

  // 3. Save to Tenant store config
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found.');

  tenant.paidAddons = tenant.paidAddons || {};
  tenant.paidAddons.uberEats = tenant.paidAddons.uberEats || { stores: [] };
  
  let storeConfig = tenant.paidAddons.uberEats.stores.find(
    (s) => s.storeId.toString() === storeId.toString()
  );

  if (!storeConfig) {
    storeConfig = { storeId };
    tenant.paidAddons.uberEats.stores.push(storeConfig);
  }

  storeConfig.accessToken = encrypt(access_token);
  if (refresh_token) {
    storeConfig.refreshToken = encrypt(refresh_token);
  }
  storeConfig.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
  storeConfig.isConnected = true;
  storeConfig.connectedAt = new Date();

  await tenant.save();
  return storeConfig;
}

/**
 * Refresh a store's access token using its refresh token
 * @param {string} tenantId
 * @param {string} storeId
 * @returns {Promise<string>} fresh access token
 */
async function refreshStoreToken(tenantId, storeId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found.');

  const uberConfig = tenant.paidAddons?.uberEats;
  const storeConfig = uberConfig?.stores?.find(
    (s) => s.storeId.toString() === storeId.toString()
  );

  if (!storeConfig || !storeConfig.refreshToken) {
    throw new Error('Store does not have active refresh token config.');
  }

  const platformSettings = await PlatformUberSettings.findOne({ singletonKey: 'default' }).select('+clientSecret').lean();
  if (!platformSettings || !platformSettings.clientId || !platformSettings.clientSecret) {
    throw new Error('Platform Uber credentials missing.');
  }

  const decryptedClientSecret = decrypt(platformSettings.clientSecret);
  const decryptedRefreshToken = decrypt(storeConfig.refreshToken);

  const response = await axios.post(
    UBER_TOKEN_URL,
    new URLSearchParams({
      client_id: platformSettings.clientId,
      client_secret: decryptedClientSecret,
      grant_type: 'refresh_token',
      refresh_token: decryptedRefreshToken,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const { access_token, refresh_token, expires_in } = response.data;
  if (!access_token) {
    throw new Error('Failed to refresh Uber access token.');
  }

  storeConfig.accessToken = encrypt(access_token);
  if (refresh_token) {
    storeConfig.refreshToken = encrypt(refresh_token);
  }
  storeConfig.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
  storeConfig.isConnected = true;

  await tenant.save();
  return access_token;
}

/**
 * Get valid (unexpired) access token for a given store, refreshing it if needed
 * @param {string} tenantId
 * @param {string} storeId
 * @returns {Promise<string>} valid access token
 */
async function getStoreAccessToken(tenantId, storeId) {
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) throw new Error('Tenant not found.');

  const storeConfig = tenant.paidAddons?.uberEats?.stores?.find(
    (s) => s.storeId.toString() === storeId.toString()
  );

  if (!storeConfig || !storeConfig.accessToken) {
    throw new Error('Store is not connected to Uber Eats.');
  }

  const bufferTime = 5 * 60 * 1000; // Refresh 5 minutes before expiry
  const isExpired = !storeConfig.tokenExpiresAt || new Date(storeConfig.tokenExpiresAt) - new Date() < bufferTime;

  if (isExpired && storeConfig.refreshToken) {
    return refreshStoreToken(tenantId, storeId);
  }

  return decrypt(storeConfig.accessToken);
}

module.exports = {
  exchangeCodeForStoreToken,
  refreshStoreToken,
  getStoreAccessToken,
};
