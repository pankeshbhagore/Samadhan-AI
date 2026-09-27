import axios from 'axios';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || '/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');
export const updateProfile = (data) => API.put('/auth/profile', data);
export const changePassword = (data) => API.put('/auth/change-password', data);

// States
export const getStates = () => API.get('/states');

// Complaints
export const submitComplaint = (data) => API.post('/complaints', data);
export const getComplaints = (params) => API.get('/complaints', { params });
export const getComplaint = (id) => API.get(`/complaints/${id}`);
export const assignComplaint = (id, data) => API.post(`/complaints/${id}/assign`, data);
export const remindDeptHead = (id) => API.put(`/complaints/${id}/remind`);
export const updateComplaintStatus = (id, data) => {
  if (data instanceof FormData) {
    return API.put(`/complaints/${id}/status`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return API.put(`/complaints/${id}/status`, data);
};
export const updateSubTaskStatus = (id, data) => {
  if (data instanceof FormData) {
    return API.put(`/complaints/${id}/subtasks`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return API.put(`/complaints/${id}/subtasks`, data);
};
export const citizenVerify = (id, data) => API.post(`/complaints/${id}/verify`, data);
export const upvoteComplaint = (id) => API.post(`/complaints/${id}/upvote`);
export const getNearbyComplaints = (params) => API.get('/complaints/nearby', { params });
export const getDashboardStats = (params) => API.get('/complaints/stats', { params });
export const getComments = (id) => API.get(`/complaints/${id}/comments`);
export const addComment = (id, data) => API.post(`/complaints/${id}/comments`, data);

// Users / Officers
export const getOfficers = (params) => API.get('/users/officers', { params });
export const getOfficerAnalysis = (id) => API.get(`/users/officers/${id}/analysis`);
export const getOfficerPerformance = (params) => API.get('/users/officer-performance', { params });
export const getAllUsers = (params) => API.get('/users', { params });
export const createUser = (data) => API.post('/users', data);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/users/${id}`);
export const toggleUserActive = (id) => API.put(`/users/${id}/toggle-active`);

// Audit & AI
export const getAuditLogs = (params) => API.get('/audit-logs', { params });
export const getMyStats = () => API.get('/complaints/my-stats');
export const getAiAnomalies = (params) => API.get('/ai/anomalies', { params });
export const generatePressRelease = () => API.get('/reports/press-release');

// Departments
export const getDepartments = (params) => API.get('/departments', { params });
export const getDepartmentAnalysis = (id) => API.get(`/departments/${id}/analysis`);
export const createDepartment = (data) => API.post('/departments', data);
export const updateDepartment = (id, data) => API.put(`/departments/${id}`, data);
export const deleteDepartment = (id) => API.delete(`/departments/${id}`);

// Visits
export const createVisit = (data) => API.post('/visits', data);
export const updateVisit = (id, data) => API.put(`/visits/${id}`, data);
export const deleteVisit = (id) => API.delete(`/visits/${id}`);
export const getVisits = (params) => API.get('/visits', { params });
export const getVisit = (id) => API.get(`/visits/${id}`);
export const addVisitLog = (id, data) => API.post(`/visits/${id}/log`, data);
export const completeVisit = (id, data) => API.put(`/visits/${id}/complete`, data);

// Notifications
export const getNotifications = (params) => API.get('/notifications', { params });
export const markNotificationRead = (id) => API.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => API.put('/notifications/read-all');

// MCD311
export const getMCD311Status = () => API.get('/mcd311/status');

// Public tracking (no auth required)
export const trackPublic = (ticketId) => API.get(`/track/${ticketId}`);

export default API;
