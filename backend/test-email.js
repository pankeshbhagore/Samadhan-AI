require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: `"Samadhan Alerts" <${process.env.FROM_EMAIL}>`,
      to: process.env.SMTP_USER, // sending it to itself to test
      subject: "Test Email from Samadhan Backend",
      html: "<p>If you are reading this, the nodemailer configuration is working perfectly!</p>",
    });
    console.log("SUCCESS! Message sent: %s", info.messageId);
  } catch (error) {
    console.error("ERROR sending test email:", error);
  }
}

testEmail();
