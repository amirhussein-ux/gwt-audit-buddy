const nodemailer = require('nodemailer');

/**
 * Email service for verification and password reset emails
 * Uses SMTP configuration from environment variables
 */
class EmailService {
  constructor() {
    // Initialize transporter (lazy-loaded to handle missing config gracefully)
    this.transporter = null;
    this.isConfigured = this._isConfigured();
  }

  /**
   * Check if email service is configured
   * @returns {boolean} Whether SMTP credentials are available
   */
  _isConfigured() {
    return !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_FROM
    );
  }

  /**
   * Initialize transporter (called before sending emails)
   * @throws {Error} If SMTP configuration is missing
   */
  _initTransporter() {
    if (!this.isConfigured) {
      throw new Error(
        'Email service not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in .env'
      );
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT === '465', // Use TLS for port 465, STARTTLS for 587
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }
  }

  /**
   * Send email verification link
   * @param {Object} user - User document
   * @param {string} token - Email verification token
   * @returns {Promise<Object>} Nodemailer response
   */
  async sendEmailVerification(user, token) {
    if (!this.isConfigured) {
      console.warn('[EmailService] Email service not configured - skipping verification email');
      return null;
    }

    try {
      this._initTransporter();

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const verificationUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(
        user.email
      )}`;

      const mailOptions = {
        from: process.env.SMTP_FROM,
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
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('[EmailService] Verification email sent to', user.email);
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
   * @returns {Promise<Object>} Nodemailer response
   */
  async sendPasswordReset(user, token) {
    if (!this.isConfigured) {
      console.warn('[EmailService] Email service not configured - skipping password reset email');
      return null;
    }

    try {
      this._initTransporter();

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(
        user.email
      )}`;

      const mailOptions = {
        from: process.env.SMTP_FROM,
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
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('[EmailService] Password reset email sent to', user.email);
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
   * @returns {Promise<Object>} Nodemailer response
   */
  async sendAccountLockedNotification(user, lockDurationMinutes) {
    if (!this.isConfigured) {
      console.warn('[EmailService] Email service not configured - skipping account locked notification');
      return null;
    }

    try {
      this._initTransporter();

      const mailOptions = {
        from: process.env.SMTP_FROM,
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
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('[EmailService] Account locked notification sent to', user.email);
      return result;
    } catch (error) {
      console.error('[EmailService] Failed to send account locked notification:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
