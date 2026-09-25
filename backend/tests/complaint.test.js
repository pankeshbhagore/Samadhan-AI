const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

describe('Citizen Complaint Submission Flow', () => {
  let citizenToken = '';
  let citizenId = '';

  beforeAll(async () => {
    // Wait for DB connection if not already established
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/samadhan_test');
    }
    
    // Create a mock citizen
    await User.deleteMany({ email: 'testcitizen@example.com' });
    const citizen = await User.create({
      name: 'Test Citizen',
      email: 'testcitizen@example.com',
      password: 'password123',
      role: 'citizen',
      state: 'MH',
      isActive: true
    });
    citizenId = citizen._id.toString();

    // Login to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testcitizen@example.com', password: 'password123' });
    
    citizenToken = res.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'testcitizen@example.com' });
    // Keep mongoose connection open if it's reused, or close it if necessary.
    // We will leave it open for other tests or close it if this is the only test file.
  });

  it('should allow a citizen to submit a valid complaint', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'Water pipe burst in my street',
        description: 'There is a massive water pipe burst causing flooding.',
        category: 'water_supply',
        address: '123 Test St, Mumbai',
        state: 'MH',
        location: {
          lat: 19.0760,
          lng: 72.8777
        }
      });

    // The API should successfully create the complaint and auto-generate a ticketId
    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toEqual(true);
    expect(res.body.complaint).toHaveProperty('ticketId');
    expect(res.body.complaint.category).toEqual('water_supply');
    expect(res.body.complaint.state).toEqual('MH');
    expect(['submitted', 'assigned']).toContain(res.body.complaint.status);
  });

  it('should reject a complaint with missing required fields', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        description: 'Missing title and category'
      });

    expect(res.statusCode).toEqual(400); // Validation error
    expect(res.body.success).toEqual(false);
  });
});
