const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP credentials not configured. Email not sent.');
      return;
    }
    const info = await transporter.sendMail({
      from: `Samadhan Updates <${process.env.FROM_EMAIL || 'noreply@samadhan.in'}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent: ${info.messageId}`);
  } catch (error) {
    console.error('Failed to send email:', error.message);
  }
};

const sendComplaintCreatedEmail = async (citizenEmail, ticketId, title) => {
  if (!citizenEmail) return;
  const trackingUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/track/${ticketId}`;
  
  const subject = `Complaint Registered: ${ticketId}`;
  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #4f46e5; padding: 24px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Samadhan AI</h2>
        <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 14px;">Public Grievance Resolution Portal</p>
      </div>
      
      <div style="padding: 32px; color: #374151;">
        <p style="font-size: 16px; margin-bottom: 24px;">Dear Citizen,</p>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Your complaint has been successfully registered with our system. Our Agentic AI is currently analyzing the issue and will route it to the appropriate department(s).
        </p>
        
        <div style="background-color: #f3f4f6; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 4px; margin-bottom: 32px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">Complaint Details:</p>
          <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 0; font-size: 16px;"><strong>Ticket ID:</strong> <span style="font-family: monospace; background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${ticketId}</span></p>
        </div>
        
        <p style="font-size: 16px; margin-bottom: 24px;">You can track the real-time progress and AI resolution plan of your complaint here:</p>
        
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${trackingUrl}" style="display: inline-block; padding: 14px 28px; color: #ffffff; background-color: #4f46e5; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Track My Complaint</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        
        <p style="font-size: 14px; color: #6b7280; margin: 0; text-align: center;">
          Thank you for helping us keep the state safe and clean.<br/>
          <strong>Team Samadhan</strong>
        </p>
      </div>
    </div>
  `;
  
  await sendEmail(citizenEmail, subject, html);
};

const getStepperHtml = (currentStatus) => {
  const steps = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'pending_verification', label: 'Verification' },
    { key: 'resolved', label: 'Resolved' }
  ];
  
  let currentIndex = steps.findIndex(s => s.key === currentStatus.toLowerCase());
  if (currentIndex === -1) {
    if (currentStatus.toLowerCase() === 'reopened' || currentStatus.toLowerCase() === 'escalated') currentIndex = 2; // match 'under_review' visually
    else currentIndex = 0;
  }

  return `
    <div style="margin: 30px 0 30px 10px; font-family: Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        ${steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          let circleBg = '#ffffff';
          let circleBorder = '#cbd5e1';
          let circleColor = '#94a3b8';
          let icon = `${index + 1}`;

          if (isCompleted) {
            circleBg = '#10b981';
            circleBorder = '#10b981';
            circleColor = '#ffffff';
            icon = '✓';
          } else if (isActive) {
            if (step.key === 'resolved') {
              circleBg = '#10b981';
              circleBorder = '#10b981';
              circleColor = '#ffffff';
              icon = '✓';
            } else {
              circleBg = '#3b82f6';
              circleBorder = '#3b82f6';
              circleColor = '#ffffff';
            }
          }

          const hasLine = index < steps.length - 1;
          const lineColor = isCompleted ? '#10b981' : '#e2e8f0';

          return `
            <tr>
              <td width="40" align="center" valign="top">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: ${circleBg}; border: 2px solid ${circleBorder}; color: ${circleColor}; font-weight: bold; font-size: 13px; line-height: 28px; text-align: center;">
                  ${icon}
                </div>
                ${hasLine ? `<div style="width: 3px; height: 25px; background: ${lineColor}; margin: 4px 0;"></div>` : ''}
              </td>
              <td valign="top" style="padding-top: 6px; padding-left: 15px; font-size: 15px; font-weight: ${isActive ? 'bold' : 'normal'}; color: ${isActive ? '#0f172a' : '#64748b'};">
                ${step.label}
              </td>
            </tr>
          `;
        }).join('')}
      </table>
    </div>
  `;
};

const sendComplaintUpdatedEmail = async (citizenEmail, ticketId, status, message, extraData = {}) => {
  if (!citizenEmail) return;
  const trackingUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/track/${ticketId}`;
  
  const formattedStatus = status.replace(/_/g, ' ').toUpperCase();
  const isResolved = status.toLowerCase() === 'resolved';
  const isVerification = status.toLowerCase() === 'pending_verification' || status.toLowerCase() === 'pending verification';
  
  let headerContent = `<h3 style="color: #3b82f6; margin-top: 0;">Status Update</h3>`;
  if (isResolved) {
    const days = extraData.resolutionTimeHours ? Math.ceil(extraData.resolutionTimeHours / 24) : 1;
    headerContent = `
      <h2 style="color: #10b981; margin-top: 0;">🎉 Congratulations!</h2>
      <p style="font-size: 16px; color: #334155;">Your complaint was successfully resolved in <strong>${days} ${days === 1 ? 'day' : 'days'}</strong>.</p>
    `;
  } else if (isVerification) {
    headerContent = `
      <h2 style="color: #f59e0b; margin-top: 0;">Verification Required</h2>
      <p style="font-size: 16px; color: #334155;">The assigned officer has marked your complaint as completed. Please verify the resolution.</p>
    `;
    if (extraData.resolutionNote) {
      headerContent += `<div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 15px; border-radius: 4px;"><p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Officer's Note:</strong> ${extraData.resolutionNote}</p></div>`;
    }
    if (extraData.resolutionImages && extraData.resolutionImages.length > 0) {
      const fs = require('fs');
      const path = require('path');
      const serverUrl = process.env.API_URL || 'http://localhost:5000';
      
      const imageHtml = extraData.resolutionImages.map(img => {
        try {
          // Embed locally uploaded images as base64 so they render perfectly in email clients during local development
          const filePath = path.join(__dirname, '..', img);
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).substring(1) || 'jpeg';
            const base64 = fs.readFileSync(filePath, 'base64');
            return `<img src="data:image/${ext};base64,${base64}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; margin-right: 12px; border: 2px solid #cbd5e1;" alt="Proof" />`;
          }
        } catch (e) {}
        return `<img src="${serverUrl}${img}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; margin-right: 12px; border: 2px solid #cbd5e1;" alt="Proof" />`;
      }).join('');
      
      headerContent += `<div style="margin-top: 20px;"><p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #334155;">Proof of Resolution:</p><div style="display: flex;">${imageHtml}</div></div>`;
    }
  }

  const subject = isResolved ? `🎉 Resolved: ${ticketId}` : `Update on Complaint: ${ticketId}`;
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #f8fafc; padding: 20px;">
      <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Samadhan</h1>
          <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 14px;">Grievance Tracking System</p>
        </div>

        <div style="padding: 30px;">
          ${headerContent}
          
          <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Ticket ID:</strong> ${ticketId}</p>
            <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px;"><strong>Current Status:</strong> ${formattedStatus}</p>
            <p style="margin: 8px 0 0 0; color: #334155; font-size: 15px;"><em>"${message}"</em></p>
          </div>

          ${getStepperHtml(status)}

          <div style="text-align: center; margin-top: 40px;">
            <a href="${trackingUrl}" style="display: inline-block; padding: 12px 24px; color: white; background-color: #2563eb; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
              ${isVerification ? 'Verify Resolution Now' : 'Track Full Timeline'}
            </a>
          </div>
        </div>
        
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
          This is an automated message from the Samadhan Grievance System. Please do not reply to this email.
        </div>
      </div>
    </div>
  `;
  
  await sendEmail(citizenEmail, subject, html);
};

const sendOfficerAssignedEmail = async (officerEmail, officerName, ticketId, taskDescription) => {
  if (!officerEmail) return;
  const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login`;
  
  const subject = `New Task Assigned: ${ticketId}`;
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f59e0b; padding: 20px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0;">Task Assignment</h2>
      </div>
      <div style="padding: 30px; color: #374151;">
        <p>Dear <strong>${officerName}</strong>,</p>
        <p>You have been auto-assigned a new task by the Samadhan AI Agentic system for the resolution of <strong>${ticketId}</strong>.</p>
        
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Task Description:</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 15px;">${taskDescription}</p>
        </div>
        
        <p>Please log in to your dashboard to begin working on this task.</p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; background-color: #f59e0b; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
        </div>
      </div>
    </div>
  `;
  
  await sendEmail(officerEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendComplaintCreatedEmail,
  sendComplaintUpdatedEmail,
  sendOfficerAssignedEmail
};
