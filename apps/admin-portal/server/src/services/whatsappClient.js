'use strict';

const axios = require('axios');

/**
 * Encapsulated API client for all Meta WhatsApp and Catalog Graph API integrations.
 */
class WhatsAppClient {
  /**
   * Base method to send a POST request to the WhatsApp messaging endpoint
   * @param {string} accessToken 
   * @param {string} phoneNumberId 
   * @param {string} recipientPhone 
   * @param {object} payload 
   */
  static async postMessage(accessToken, phoneNumberId, recipientPhone, payload) {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    return axios.post(url, {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      ...payload
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }

  /**
   * Specific helper to dispatch template notifications (e.g. status updates)
   * @param {string} accessToken 
   * @param {string} phoneNumberId 
   * @param {string} recipientPhone 
   * @param {string} templateName 
   * @param {Array} parameters 
   */
  static async sendTemplateNotification(accessToken, phoneNumberId, recipientPhone, templateName, parameters) {
    return this.postMessage(accessToken, phoneNumberId, recipientPhone, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: parameters
          }
        ]
      }
    });
  }

  /**
   * Helper to dispatch batch mutations to Meta's Catalog API
   * @param {string} accessToken 
   * @param {string} catalogId 
   * @param {Array} requests 
   */
  static async mutateCatalog(accessToken, catalogId, requests) {
    const url = `https://graph.facebook.com/v21.0/${catalogId}/items_batch`;
    return axios.post(url, { requests }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }
}

module.exports = WhatsAppClient;
