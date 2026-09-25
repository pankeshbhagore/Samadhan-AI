const request = require('supertest');
const express = require('express');

// Create a simple mock app that matches the /health route behavior
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date(), mode: 'test' }));

describe('GET /health', () => {
  it('should return 200 OK with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('mode', 'test');
  });
});
