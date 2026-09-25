const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Complaint = require('../models/Complaint');

describe('Officer Workflow', () => {
  let officerToken = '';
  let officerId = '';
  let complaintId = '';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/samadhan_test');
    }
    
    // Create a mock officer
    await User.deleteMany({ email: 'testofficer@example.com' });
    const officer = await User.create({
      name: 'Test Officer',
      email: 'testofficer@example.com',
      password: 'password123',
      role: 'employee',
      state: 'MH',
      isActive: true
    });
    officerId = officer._id.toString();

    // Login to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testofficer@example.com', password: 'password123' });
    
    officerToken = res.body.token;

    // Create a mock complaint assigned to this officer
    await Complaint.deleteMany({ title: 'Test Officer Complaint' });
    const citizen = await User.findOne({ role: 'citizen' }) || officer; // fallback to officer as citizen
    const complaint = await Complaint.create({
      title: 'Test Officer Complaint',
      description: 'Needs investigation.',
      category: 'water_supply',
      address: '123 Test St',
      state: 'MH',
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.0760]
      },
      citizen: citizen._id,
      assignedTo: officer._id,
      status: 'assigned'
    });
    complaintId = complaint._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'testofficer@example.com' });
    await Complaint.deleteMany({ title: 'Test Officer Complaint' });
  });

  it('should allow an officer to fetch their assigned complaints', async () => {
    const res = await request(app)
      .get('/api/complaints?assignedTo=me')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toEqual(true);
    // Since we assigned one, it should be in the results
    const found = res.body.complaints.find(c => c._id.toString() === complaintId);
    expect(found).toBeDefined();
    expect(found.title).toEqual('Test Officer Complaint');
  });

  it('should allow an officer to update the status of a complaint', async () => {
    const res = await request(app)
      .put(`/api/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        status: 'in_progress',
        message: 'Officer has started the investigation.'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toEqual(true);
    expect(res.body.complaint.status).toEqual('in_progress');
    expect(res.body.complaint.timeline.some(t => t.status === 'in_progress')).toBe(true);
  });
});
