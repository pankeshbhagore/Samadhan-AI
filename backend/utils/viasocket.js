const axios = require('axios');

/**
 * Triggers a viaSocket Webhook with a specific event type and payload.
 * Runs asynchronously and catches its own errors so it doesn't block the main thread.
 * 
 * @param {string} eventType - The type of event (e.g., 'COMPLAINT_CREATED', 'STATUS_UPDATED', 'ESCALATION_ALERT')
 * @param {Object} payload - The data to send to viaSocket
 */
const triggerViaSocketWorkflow = async (eventType, payload) => {
  const webhookUrl = process.env.VIASOCKET_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn(`[viaSocket] Warning: VIASOCKET_WEBHOOK_URL is not defined. Cannot send event: ${eventType}`);
    return;
  }

  try {
    const dataToSend = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload
    };

    // We don't await this completely in the controller to avoid blocking, 
    // but here we execute the request.
    const response = await axios.post(webhookUrl, dataToSend, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`[viaSocket] ✅ Webhook successfully triggered for event: ${eventType}. Status: ${response.status}`);
  } catch (error) {
    console.error(`[viaSocket] ❌ Failed to trigger webhook for event: ${eventType}`, error.message);
  }
};

module.exports = {
  triggerViaSocketWorkflow
};
