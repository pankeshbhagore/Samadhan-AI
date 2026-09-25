const cron = require('node-cron');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const { sendEmail } = require('./emailService');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates an AI summary of stats
 */
async function generateAIReportSummary(role, stats, state, departmentName) {
  try {
    const prompt = `
      You are an AI assistant for the Samadhan Grievance System.
      Generate a concise, professional 3-4 sentence email summary of the following statistics.
      Target Audience Role: ${role}
      Scope: ${state ? `State of ${state}` : 'National'} ${departmentName ? `| Department: ${departmentName}` : ''}
      
      Statistics:
      Total Complaints: ${stats.total}
      Resolved: ${stats.resolved}
      Pending: ${stats.pending}
      Critical: ${stats.critical}
      
      Make it encouraging but highlight areas needing attention (like high pending or critical counts).
    `;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 150
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("AI Report Generation Error:", error);
    return "Here is your automated system report containing the latest grievance statistics.";
  }
}

/**
 * Send reports based on time period (weekly, monthly, yearly)
 */
async function sendPeriodicReports(periodType, days) {
  console.log(`[CRON] Starting ${periodType} report generation...`);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Get all users who should receive reports
  const users = await User.find({ isActive: true, role: { $in: ['super_admin', 'cm', 'department_head', 'employee'] } }).populate('department');
  
  for (const user of users) {
    if (!user.email) continue;
    
    try {
      let query = { createdAt: { $gte: since } };
      let scopeName = "National";
      let deptName = null;

      // Filter based on role
      if (user.role === 'cm') {
        query.state = user.state;
        scopeName = `State of ${user.state}`;
      } else if (user.role === 'department_head') {
        query.department = user.department?._id;
        query.state = user.state;
        scopeName = `State of ${user.state}`;
        deptName = user.department?.name;
      } else if (user.role === 'employee') {
        query.assignedTo = user._id;
        scopeName = "Your Assigned Tasks";
      }

      // Aggregate Stats
      const [total, resolved, critical] = await Promise.all([
        Complaint.countDocuments(query),
        Complaint.countDocuments({ ...query, status: 'resolved' }),
        Complaint.countDocuments({ ...query, isCritical: true }),
      ]);
      
      const stats = { total, resolved, pending: total - resolved, critical };
      
      // If there's zero activity for an employee, skip to save emails, but send to admins anyway
      if (total === 0 && user.role === 'employee') continue;

      const aiSummary = await generateAIReportSummary(user.role, stats, user.state, deptName);
      
      const subject = `Samadhan ${periodType.charAt(0).toUpperCase() + periodType.slice(1)} Report: ${scopeName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Samadhan ${periodType.charAt(0).toUpperCase() + periodType.slice(1)} Performance Report</h2>
          <p>Hello ${user.name},</p>
          
          <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; font-style: italic;">
            🤖 <strong>AI Analysis:</strong><br/><br/>
            ${aiSummary}
          </div>
          
          <h3>Statistical Breakdown (${periodType}):</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">Metric</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">Count</th>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #cbd5e1;">Total Grievances</td>
              <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;"><strong>${stats.total}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #cbd5e1;">Resolved</td>
              <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; color: #16a34a;"><strong>${stats.resolved}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #cbd5e1;">Pending</td>
              <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; color: #d97706;"><strong>${stats.pending}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #cbd5e1;">Critical</td>
              <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; color: #dc2626;"><strong>${stats.critical}</strong></td>
            </tr>
          </table>
          
          <p>Login to your <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}">Samadhan Dashboard</a> for full insights.</p>
          <p>Best regards,<br/>Samadhan AI Coordinator</p>
        </div>
      `;
      
      // Use the raw transporter from emailService. Wait, I need to export the raw sendEmail function from emailService.js
      const { sendEmail } = require('./emailService');
      await sendEmail(user.email, subject, html);
      
    } catch (err) {
      console.error(`Failed to generate report for ${user.email}:`, err);
    }
  }
  console.log(`[CRON] ${periodType} report generation complete.`);
}

function initCronJobs() {
  console.log('🕒 Initializing Cron Jobs for Automated Reporting...');
  
  // Weekly Report: Every Sunday at 8:00 AM
  cron.schedule('0 8 * * 0', () => {
    sendPeriodicReports('weekly', 7);
  });

  // Monthly Report: 1st of every month at 8:00 AM
  cron.schedule('0 8 1 * *', () => {
    sendPeriodicReports('monthly', 30);
  });

  // Yearly Report: 1st of January at 8:00 AM
  cron.schedule('0 8 1 1 *', () => {
    sendPeriodicReports('yearly', 365);
  });
}

module.exports = { initCronJobs, sendPeriodicReports };
