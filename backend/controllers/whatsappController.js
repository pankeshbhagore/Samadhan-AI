const { MessagingResponse } = require('twilio').twiml;
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Department = require('../models/Department');
const { classifyComplaint } = require('../services/aiClassification');
const { asyncHandler } = require('../middleware/errorHandler');
const { getNextSequence } = require('../models/Counter'); // Used by Complaint model pre-save, but maybe we just use Complaint.create

exports.handleWebhook = asyncHandler(async (req, res) => {
  const incomingMsg = req.body.Body || '';
  const fromNumber = req.body.From || '';
  
  const twiml = new MessagingResponse();

  if (!incomingMsg.trim()) {
    twiml.message('Please provide a description of your complaint.');
    return res.type('text/xml').send(twiml.toString());
  }

  try {
    // 1. Find or create user based on WhatsApp number
    const phone = fromNumber.replace('whatsapp:', '').trim();
    let citizen = await User.findOne({ phone });
    
    if (!citizen) {
      // Create a temporary citizen account
      citizen = await User.create({
        name: `WhatsApp Citizen (${phone.slice(-4)})`,
        email: `whatsapp_${phone}@cmdashboard.local`,
        password: Math.random().toString(36).slice(-10), // Random secure password
        phone,
        role: 'citizen'
      });
    }

    // 2. Classify the complaint
    // We treat the first sentence as title, rest as description, or just use the whole thing for both
    const textLines = incomingMsg.split('\n').filter(l => l.trim().length > 0);
    const title = textLines[0].substring(0, 100);
    const description = incomingMsg;
    
    const locationObj = { type: 'Point', coordinates: [77.2090, 28.6139] }; // Default Delhi coords
    
    const ai = classifyComplaint(title, description);

    // 3. Find matching department
    let dept = null;
    if (ai.category !== 'other') {
      dept = await Department.findOne({ categoryMatches: ai.category });
    }

    // Calculate due date based on priority
    const dueHours = ai.priority === 'critical' ? 4 : (ai.priority === 'high' ? 24 : (ai.priority === 'medium' ? 72 : 168));
    const dueDate = new Date(Date.now() + dueHours * 60 * 60 * 1000);

    // 4. Create the complaint
    const complaint = await Complaint.create({
      title,
      description,
      address: 'Reported via WhatsApp',
      location: locationObj,
      category: ai.category,
      priority: ai.isCritical ? 'critical' : ai.priority,
      isCritical: ai.isCritical,
      criticalReason: ai.criticalReason,
      department: dept?._id,
      citizen: citizen._id,
      source: 'whatsapp',
      dueDate,
      timeline: [{ status: 'submitted', message: 'Complaint reported via WhatsApp', updatedBy: citizen._id }]
    });

    if (dept) {
      await Department.findByIdAndUpdate(dept._id, { $inc: { 'stats.totalComplaints': 1, 'stats.pending': 1 } });
    }

    // 5. Build WhatsApp response
    let replyMsg = `✅ Your complaint has been registered!\n\n*Ticket ID:* ${complaint.ticketId}\n*Category:* ${ai.category.replace('_', ' ').toUpperCase()}\n*Priority:* ${ai.priority.toUpperCase()}`;
    
    if (ai.isCritical) {
      replyMsg += `\n🚨 Marked as CRITICAL. Immediate attention requested.`;
    }

    replyMsg += `\n\nWe will update you on this number as progress is made.`;

    twiml.message(replyMsg);
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('WhatsApp Webhook Error:', err);
    twiml.message('Sorry, we encountered an error processing your complaint. Please try again later.');
    res.type('text/xml').send(twiml.toString());
  }
});
