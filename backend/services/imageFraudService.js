const { Jimp } = require('jimp');
const path = require('path');
const Complaint = require('../models/Complaint');
const AuditLog = require('../models/AuditLog');

function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 999;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

async function processImageForFraud(filePath, complaintId, officerId, io) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    const image = await Jimp.read(fullPath);
    // Returns base64 encoded perceptual hash
    const hash = image.hash();

    // Look for previous hashes in the last 1000 complaints to prevent duplicate uploads
    const [recentComplaints, currentComplaint] = await Promise.all([
      Complaint.find({
        'verification.proofImageHashes': { $exists: true, $not: { $size: 0 } },
        _id: { $ne: complaintId }
      }).select('ticketId verification.proofImageHashes').sort('-createdAt').limit(1000).lean(),
      Complaint.findById(complaintId).select('state')
    ]);

    for (const comp of recentComplaints) {
      for (const existingHash of comp.verification?.proofImageHashes || []) {
        const dist = hammingDistance(hash, existingHash);
        // If distance is very small, the images are visually identical or slight crops/re-encodings
        if (dist <= 3) {
          console.warn(`[FRAUD ALERT] Image matches previous ticket ${comp.ticketId}`);
          
          await AuditLog.create({
            action: 'FALSE_CLOSURE_DETECTED',
            entityType: 'complaint',
            entityId: complaintId,
            performedBy: officerId,
            details: { reason: 'Duplicate proof image detected across complaints' },
            suspicious: true,
            state: currentComplaint?.state,
            suspicionReason: `Image Fraud: Upload visually matches an image from older ticket ${comp.ticketId} (dist=${dist})`
          });

          if (io) {
            io.to('role_cm').to('role_super_admin').emit('false_closure_alert', {
              complaint: { id: complaintId },
              officerId,
              reason: `Uploaded image is a duplicate of ticket ${comp.ticketId}`
            });
          }

          return { isFraud: true, hash, matchedTicket: comp.ticketId };
        }
      }
    }
    return { isFraud: false, hash };
  } catch (err) {
    console.error('Error generating image hash:', err.message);
    return { isFraud: false, hash: null };
  }
}

module.exports = { processImageForFraud };
