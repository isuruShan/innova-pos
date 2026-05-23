'use strict';

const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/google-business/oauth/callback';

function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/**
 * Generate OAuth URL for Google Business Profile management scopes
 */
function getAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state: state,
    scope: [
      'https://www.googleapis.com/auth/business.manage',
    ],
  });
}

/**
 * Exchange code for access & refresh tokens
 */
async function getTokensFromCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Create configured auth client from tokens
 */
function getClientWithTokens(tokens) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

/**
 * List GBP accounts for the connected user
 */
async function getGbpAccounts(authClient) {
  const accountmanagement = google.mybusinessaccountmanagement({
    version: 'v1',
    auth: authClient,
  });

  const response = await accountmanagement.accounts.list();
  return response.data.accounts || [];
}

/**
 * Create new location under account
 */
async function createLocation(authClient, accountName, details) {
  const businessinformation = google.mybusinessbusinessinformation({
    version: 'v1',
    auth: authClient,
  });

  const locationPayload = {
    title: details.businessName,
    primaryPhone: details.phone || undefined,
    websiteUri: details.website || undefined,
    languageCode: 'en',
    storefrontAddress: {
      regionCode: details.countryIso || 'LK',
      addressLines: [details.address],
    },
    primaryCategory: {
      name: details.category || 'categories/gcid:restaurant',
    },
  };

  const response = await businessinformation.accounts.locations.create({
    parent: accountName,
    requestBody: locationPayload,
    // Google requires a unique clientRequestId for idempotency
    requestId: `req-${Date.now()}`,
  });

  return response.data;
}

/**
 * Sync (patch) location details
 */
async function syncLocation(authClient, locationName, details) {
  const businessinformation = google.mybusinessbusinessinformation({
    version: 'v1',
    auth: authClient,
  });

  const locationPayload = {
    title: details.businessName,
    primaryPhone: details.phone || undefined,
    websiteUri: details.website || undefined,
    storefrontAddress: {
      regionCode: details.countryIso || 'LK',
      addressLines: [details.address],
    },
  };

  // Construct updateMask based on fields that are updated
  const updateMask = 'title,primaryPhone,websiteUri,storefrontAddress';

  const response = await businessinformation.locations.patch({
    name: locationName,
    updateMask,
    requestBody: locationPayload,
  });

  return response.data;
}

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  getClientWithTokens,
  getGbpAccounts,
  createLocation,
  syncLocation,
};
