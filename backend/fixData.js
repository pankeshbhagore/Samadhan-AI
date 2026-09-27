const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/samadhan');
  console.log('Connected to DB');
  
  const Complaint = mongoose.connection.collection('complaints');
  
  // Find all complaints with agentic plans and clear assignedTo from subtasks
  const complaints = await Complaint.find({ 'agenticPlan': { $exists: true } }).toArray();
  
  for (let c of complaints) {
    if (c.agenticPlan) {
      let changed = false;
      for (let t of c.agenticPlan) {
        if (t.assignedTo) {
          t.assignedTo = null;
          t.status = 'pending'; // Reset status too so they can be re-claimed
          changed = true;
        }
      }
      if (changed) {
        await Complaint.updateOne({ _id: c._id }, { $set: { agenticPlan: c.agenticPlan } });
      }
    }
  }
  
  console.log('Cleaned up corrupted subtask assignments.');
  process.exit(0);
}

run();
