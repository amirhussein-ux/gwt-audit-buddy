const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { getConfig } = require('../config/env');

/**
 * Email service for verification and password reset emails
 * Uses SMTP configuration from environment variables
 */
class EmailService {
  constructor() {
    // Lazy-initialized providers
    this.transporter = null;
    this.resendClient = null;
    this.resendUnavailable = false;
  }

  _hasResendConfig() {
    return Boolean(getConfig().resendApiKey);
  }

  _hasSmtpConfig() {
    return Boolean(getConfig().smtp);
  }

  _getFromAddress() {
    const config = getConfig();
    return config.resendFromEmail || config.smtp?.from || 'GWT Audit Buddy <noreply@resend.dev>';
  }

  _getResendClient() {
    if (this.resendUnavailable) return null;
    if (!this._hasResendConfig()) return null;
    if (!this.resendClient) {
      this.resendClient = new Resend(getConfig().resendApiKey);
    }
    return this.resendClient;
  }

  /**
   * Initialize SMTP transporter (fallback provider)
   * @throws {Error} If SMTP configuration is missing
   */
  _initTransporter() {
    if (!this._hasSmtpConfig()) {
      throw new Error(
        'Email service not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in .env'
      );
    }

    if (!this.transporter) {
      const smtpConfig = getConfig().smtp;
      this.transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.password,
        },
      });
    }
  }

  async _sendEmail({ to, subject, html, text }) {
    const from = this._getFromAddress();

    const resendClient = this._getResendClient();
    if (resendClient) {
      try {
        const result = await resendClient.emails.send({ from, to, subject, html, text });
        return { provider: 'resend', result };
      } catch (error) {
        console.error('[EmailService] Resend send failed, falling back to SMTP if configured:', error.message);
      }
    }

    if (this._hasSmtpConfig()) {
      this._initTransporter();
      const result = await this.transporter.sendMail({ from, to, subject, html, text });
      return { provider: 'smtp', result };
    }

    console.warn('[EmailService] No email provider configured (Resend/SMTP) - skipping send');
    return null;
  }

  /**
   * Send email verification link
   * @param {Object} user - User document
   * @param {string} token - Email verification token
   * @returns {Promise<Object|null>} Provider response or null when skipped
   */
  async sendEmailVerification(user, token) {
    try {
      const config = getConfig();
      const frontendUrl = config.frontendUrl;
      const verificationUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(
        user.email
      )}`;

      const result = await this._sendEmail({
        to: user.email,
        subject: 'Verify Your Email - GWT Audit Buddy',
        html: `
          <h2>Welcome to GWT Audit Buddy!</h2>
          <p>Hi ${user.username},</p>
          <p>Please verify your email address to activate your account.</p>
          <p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Verify Email
            </a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <pre>${verificationUrl}</pre>
          <p><small>This link will expire in 24 hours.</small></p>
          <p>If you didn't create this account, please ignore this email.</p>
        `,
        text: `
Please verify your email by visiting: ${verificationUrl}

This link will expire in 24 hours.
        `,
      });

      if (result) {
        console.log(`[EmailService] Verification email sent via ${result.provider} to ${user.email}`);
      }
      return result;
    } catch (error) {
      console.error('[EmailService] Failed to send verification email:', error.message);
      throw error;
    }
  }

  /**
   * Send password reset link
   * @param {Object} user - User document
   * @param {string} token - Password reset token
   * @returns {Promise<Object|null>} Provider response or null when skipped
   */
  async sendPasswordReset(user, token) {
    try {
      const config = getConfig();
      const frontendUrl = config.frontendUrl;
      const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(
        user.email
      )}`;

      const result = await this._sendEmail({
        to: user.email,
        subject: 'Password Reset Request - GWT Audit Buddy',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${user.username},</p>
          <p>We received a request to reset your password.</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <pre>${resetUrl}</pre>
          <p><small>This link will expire in 15 minutes. If you didn't request this, please ignore this email.</small></p>
          <p>If you have any questions, contact support.</p>
        `,
        text: `
Click the link to reset your password: ${resetUrl}

This link will expire in 15 minutes.
        `,
      });

      if (result) {
        console.log(`[EmailService] Password reset email sent via ${result.provider} to ${user.email}`);
      }
      return result;
    } catch (error) {
      console.error('[EmailService] Failed to send password reset email:', error.message);
      throw error;
    }
  }

  /**
   * Send account locked notification
   * @param {Object} user - User document
   * @param {number} lockDurationMinutes - How long account is locked
   * @returns {Promise<Object|null>} Provider response or null when skipped
   */
  async sendAccountLockedNotification(user, lockDurationMinutes) {
    try {
      const result = await this._sendEmail({
        to: user.email,
        subject: 'Account Security Alert - GWT Audit Buddy',
        html: `
          <h2>Account Temporarily Locked</h2>
          <p>Hi ${user.username},</p>
          <p>We detected multiple failed login attempts on your account.</p>
          <p>Your account has been temporarily locked for ${lockDurationMinutes} minutes as a security measure.</p>
          <p>If this wasn't you, please reset your password immediately.</p>
          <p>If you have questions, contact support.</p>
        `,
        text: `
Your account has been temporarily locked due to multiple failed login attempts.
It will be unlocked in ${lockDurationMinutes} minutes.
        `,
      });

      if (result) {
        console.log(`[EmailService] Account locked notification sent via ${result.provider} to ${user.email}`);
      }
      return result;
    } catch (error) {
      console.error('[EmailService] Failed to send account locked notification:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
