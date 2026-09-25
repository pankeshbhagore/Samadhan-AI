const Notification = require('../models/Notification');

/**
 * Creates a persistent Notification record AND emits a real-time socket
 * event if `io` is provided. This fixes the earlier design flaw where
 * alerts were purely transient socket emissions — if a user was offline
 * or simply on a different page, the alert was lost forever with no
 * notification inbox to check later.
 */
async function notify(io, { recipientId, type, title, message, complaintId }) {
  const notification = await Notification.create({
    recipient: recipientId,
    type,
    title,
    message,
    complaint: complaintId
  });

  if (io && recipientId) {
    io.to(`user_${recipientId}`).emit('notification', {
      _id: notification._id,
      type,
      title,
      message,
      complaintId,
      createdAt: notification.createdAt
    });
  }

  return notification;
}

async function notifyMany(io, recipientIds, payload) {
  return Promise.all(
    [...new Set(recipientIds.filter(Boolean).map(String))].map((id) =>
      notify(io, { ...payload, recipientId: id })
    )
  );
}

module.exports = { notify, notifyMany };
