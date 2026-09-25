/**
 * MCD311 API Integration Service
 * Falls back to mock mode automatically — the app must NEVER fail or
 * block a complaint submission because a government API is unavailable.
 */

const axios = require('axios');

const MCD311_BASE = process.env.MCD311_API_BASE || 'https://api.mcd311.gov.in/v1';
const MCD311_KEY = process.env.MCD311_API_KEY;
const TIMEOUT_MS = 5000;

const MOCK_DEPARTMENTS = [
  { id: 'MCD001', name: 'Roads & Infrastructure', categories: ['roads_potholes', 'drainage'] },
  { id: 'MCD002', name: 'Water Supply', categories: ['water_supply', 'sewage'] },
  { id: 'MCD003', name: 'Sanitation', categories: ['garbage_sanitation'] },
  { id: 'MCD004', name: 'Electricity', categories: ['electricity', 'street_lights'] },
  { id: 'MCD005', name: 'Traffic Police', categories: ['traffic'] }
];

const isMockMode = () => !MCD311_KEY || MCD311_KEY === 'mock_key_replace_in_production';

async function syncComplaintToMCD311(complaint) {
  if (isMockMode()) {
    return {
      success: true,
      mcd311TicketId: `MCD-${Date.now()}`,
      status: 'submitted',
      isMock: true
    };
  }

  try {
    const { data } = await axios.post(`${MCD311_BASE}/complaints`, {
      externalId: complaint.ticketId,
      category: complaint.category,
      description: complaint.description,
      location: complaint.location,
      priority: complaint.priority
    }, { headers: { 'X-API-Key': MCD311_KEY }, timeout: TIMEOUT_MS });
    return { success: true, ...data, isMock: false };
  } catch (err) {
    console.warn('[MCD311] API unavailable, using offline fallback:', err.message);
    return {
      success: false,
      mcd311TicketId: `OFFLINE-${Date.now()}`,
      status: 'queued_for_sync',
      isMock: true,
      error: err.message
    };
  }
}

async function getMCD311Status(mcd311TicketId) {
  if (isMockMode() || /^(OFFLINE|MCD)-/.test(mcd311TicketId || '')) {
    return { success: true, status: 'in_progress', lastUpdated: new Date(), isMock: true };
  }
  try {
    const { data } = await axios.get(`${MCD311_BASE}/complaints/${mcd311TicketId}`, {
      headers: { 'X-API-Key': MCD311_KEY }, timeout: TIMEOUT_MS
    });
    return { success: true, ...data, isMock: false };
  } catch (err) {
    return { success: false, isMock: true, error: err.message };
  }
}

async function getDepartments() {
  if (isMockMode()) return { success: true, departments: MOCK_DEPARTMENTS, isMock: true };
  try {
    const { data } = await axios.get(`${MCD311_BASE}/departments`, {
      headers: { 'X-API-Key': MCD311_KEY }, timeout: TIMEOUT_MS
    });
    return { success: true, ...data, isMock: false };
  } catch {
    return { success: true, departments: MOCK_DEPARTMENTS, isMock: true };
  }
}

async function isApiAvailable() {
  if (isMockMode()) return false;
  try {
    await axios.get(`${MCD311_BASE}/health`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = { syncComplaintToMCD311, getMCD311Status, getDepartments, isApiAvailable, isMockMode };
