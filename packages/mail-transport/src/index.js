const nodemailer = require('nodemailer');

let cached;

/**
 * Returns null if outbound mail can be sent, otherwise a short reason (startup warnings).
 *
 * Configuration (pick one):
 * 1) Generic SMTP — set SMTP_HOST, SMTP_USER, SMTP_PASS (optional: SMTP_PORT default 587, SMTP_SECURE)
 * 2) Gmail — leave SMTP_HOST unset; set EMAIL_FROM + EMAIL_APP_PASSWORD (Google app password)
 */
function getMailConfigurationIssue() {
  if (!String(process.env.EMAIL_FROM || '').trim()) {
    return 'EMAIL_FROM is not set';
  }

  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  if (smtpHost) {
    if (!String(process.env.SMTP_USER || '').trim() || !String(process.env.SMTP_PASS || '').trim()) {
      return 'SMTP_HOST is set — also set SMTP_USER and SMTP_PASS';
    }
    return null;
  }

  if (!String(process.env.EMAIL_APP_PASSWORD || '').trim()) {
    return 'Set EMAIL_APP_PASSWORD (Gmail app password), or set SMTP_HOST + SMTP_USER + SMTP_PASS for another provider';
  }
  return null;
}

function buildTransportOptions() {
  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  if (smtpHost) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure =
      process.env.SMTP_SECURE === 'true' ||
      process.env.SMTP_SECURE === '1' ||
      port === 465;
    return {
      host: smtpHost,
      port,
      secure,
      auth: {
        user: String(process.env.SMTP_USER || '').trim(),
        pass: String(process.env.SMTP_PASS || '').trim(),
      },
    };
  }

  return {
    service: 'gmail',
    auth: {
      user: String(process.env.EMAIL_FROM || '').trim(),
      pass: String(process.env.EMAIL_APP_PASSWORD || '').trim(),
    },
  };
}

/** Cached Nodemailer transport (singleton). */
function getMailTransporter() {
  if (cached) return cached;
  const issue = getMailConfigurationIssue();
  if (issue) {
    throw new Error(issue);
  }
  cached = nodemailer.createTransport(buildTransportOptions());
  return cached;
}

function resetMailTransporterCache() {
  cached = null;
}

module.exports = {
  getMailConfigurationIssue,
  getMailTransporter,
  resetMailTransporterCache,
};
