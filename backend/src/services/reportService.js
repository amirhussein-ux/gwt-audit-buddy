const { Resend } = require('resend');
const { getConfig } = require('../config/env');

/**
 * Email service using Resend API
 * Handles sending report confirmation and admin notification emails
 */

let resend = null;

/**
 * Get or initialize Resend client
 * @returns {Resend|null} Resend client instance or null if not configured
 */
function getResendClient() {
  if (resend === null) {
    const config = getConfig();
    if (config.resendApiKey) {
      resend = new Resend(config.resendApiKey);
    } else {
      console.warn('[ReportService] WARNING: RESEND_API_KEY not configured. Email reports will fail.');
      resend = false; // Set to false to avoid repeated initialization attempts
    }
  }
  return resend || null;
}

const APP_NAME = 'GWT Audit Buddy';

/**
 * Send report confirmation email to reporter
 * @param {string} recipientEmail - Reporter's email
 * @param {Object} reportData - Report data
 */
const sendReportConfirmationEmail = async (recipientEmail, reportData) => {
  const resendClient = getResendClient();
  if (!resendClient) {
    console.error('[ReportService] Resend not configured - cannot send confirmation email');
    return;
  }

  const config = getConfig();
  const appUrl = config.appUrl;

  try {
    const categoryLabel = {
      bug: 'Bug Report',
      feature_request: 'Feature Request',
      performance_issue: 'Performance Issue',
      data_accuracy: 'Data Accuracy Issue',
      other: 'General Feedback',
    }[reportData.category] || reportData.category;

    const priorityLabel = reportData.priority.charAt(0).toUpperCase() + reportData.priority.slice(1);

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Thank You for Your Report</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${APP_NAME}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 30px 20px;">
          <p style="color: #1f2937; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
            We've received your report and our team will review it shortly. Thank you for helping us improve ${APP_NAME}!
          </p>
          
          <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 14px; font-weight: 600;">Report Details</h3>
            
            <div style="margin-bottom: 12px;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 500;">Category</p>
              <p style="margin: 0; color: #1f2937; font-size: 14px;">${categoryLabel}</p>
            </div>
            
            <div style="margin-bottom: 12px;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 500;">Priority</p>
              <p style="margin: 0; color: #1f2937; font-size: 14px;">${priorityLabel}</p>
            </div>
            
            <div style="margin-bottom: 12px;">
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 500;">Title</p>
              <p style="margin: 0; color: #1f2937; font-size: 14px;">${reportData.title}</p>
            </div>
            
            <div>
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 500;">Submitted</p>
              <p style="margin: 0; color: #1f2937; font-size: 14px;">${new Date(reportData.createdAt).toLocaleString()}</p>
            </div>
          </div>
          
          <p style="color: #6b7280; margin: 0; font-size: 13px; line-height: 1.6;">
            If you have any questions, feel free to reach out. We appreciate your feedback and are committed to continuously improving ${APP_NAME}.
          </p>
        </div>
        
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; margin: 0; font-size: 12px;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const result = await resendClient.emails.send({
      from: `${APP_NAME} <noreply@resend.dev>`,
      to: recipientEmail,
      subject: `✓ Report Received: ${reportData.title}`,
      html,
    });

    console.log('[ReportService] Confirmation email sent:', { recipientEmail, messageId: result.data?.id });
    return result;
  } catch (error) {
    console.error('[ReportService] Failed to send confirmation email:', error.message);
    throw error;
  }
};

/**
 * Send admin notification email for new report
 * @param {Object} reportData - Report data with user info
 */
const sendAdminNotificationEmail = async (reportData) => {
  const resendClient = getResendClient();
  if (!resendClient) {
    console.error('[ReportService] Resend not configured - cannot send admin notification');
    return;
  }

  const config = getConfig();
  const adminEmail = config.reportAdminEmail;

  try {
    const categoryLabel = {
      bug: '🐛 Bug Report',
      feature_request: '💡 Feature Request',
      performance_issue: '⚡ Performance Issue',
      data_accuracy: '📊 Data Accuracy Issue',
      other: '💬 General Feedback',
    }[reportData.category] || reportData.category;

    const priorityColor = {
      high: '#dc2626',
      medium: '#f59e0b',
      low: '#10b981',
    }[reportData.priority];

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Report Submitted</h1>
        </div>
        
        <div style="background: white; padding: 30px 20px; border-bottom: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">${reportData.title}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Reported by: ${reportData.userName || 'Unknown'} (${reportData.email})</p>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; background: #f3f4f6; color: #1f2937; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 500; margin-bottom: 8px;">
                ${categoryLabel}
              </span>
              <div style="display: inline-block; background-color: ${priorityColor}20; border-left: 3px solid ${priorityColor}; padding: 6px 12px; border-radius: 4px;">
                <p style="margin: 0; color: ${priorityColor}; font-size: 13px; font-weight: 600; text-transform: uppercase;">
                  ${reportData.priority} Priority
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div style="background: #f9fafb; padding: 20px;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 14px; font-weight: 600;">Description</h3>
          <div style="background: white; padding: 15px; border-radius: 4px; border-left: 3px solid #667eea;">
            <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
              ${reportData.description}
            </p>
          </div>
          
          ${reportData.attachment ? `
            <h3 style="margin: 20px 0 12px 0; color: #1f2937; font-size: 14px; font-weight: 600;">Attachment</h3>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">
              📎 ${reportData.attachment.filename} (${(reportData.attachment.size / 1024).toFixed(2)} KB)
            </p>
          ` : ''}
        </div>
        
        <div style="background: #f3f4f6; padding: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;">
            <strong>Reported:</strong> ${new Date(reportData.createdAt).toLocaleString()}
          </p>
          <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px;">
            <strong>Report ID:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 12px;">${reportData._id}</code>
          </p>
          <p style="margin: 0; color: #6b7280; font-size: 13px;">
            <strong>Reporter:</strong> ${reportData.email}
          </p>
        </div>
      </div>
    `;

    const result = await resendClient.emails.send({
      from: `${APP_NAME} <noreply@resend.dev>`,
      to: adminEmail,
      subject: `[${reportData.priority.toUpperCase()}] New Report: ${reportData.title}`,
      html,
    });

    console.log('[ReportService] Admin notification sent:', { adminEmail, messageId: result.data?.id });
    return result;
  } catch (error) {
    console.error('[ReportService] Failed to send admin notification:', error.message);
    throw error;
  }
};

module.exports = {
  sendReportConfirmationEmail,
  sendAdminNotificationEmail,
};
