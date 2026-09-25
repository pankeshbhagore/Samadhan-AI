const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Atomically increments and returns the next sequence number for `name`.
 * Using findByIdAndUpdate with $inc is atomic at the MongoDB level, so
 * concurrent requests can never receive the same sequence number —
 * unlike the previous countDocuments()-based approach which had a
 * read-then-write race condition under concurrent complaint submissions.
 */
async function getNextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = { Counter, getNextSequence };
