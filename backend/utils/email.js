const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // If SMTP variables are not set, just log and return
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn(`[Email] Skipping email to ${options.to} because SMTP is not configured in .env`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const message = {
      from: `${process.env.FROM_NAME || 'Samadhan Team'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    const info = await transporter.sendMail(message);
    console.log(`[Email] ✅ Email sent to ${options.to} (Message ID: ${info.messageId})`);
  } catch (error) {
    console.error(`[Email] ❌ Error sending email to ${options.to}:`, error.message);
  }
};

module.exports = sendEmail;
