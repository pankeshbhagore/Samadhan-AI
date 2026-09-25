export const CATEGORY_LABELS = {
  roads_potholes: 'Roads / Potholes', water_supply: 'Water Supply', garbage_sanitation: 'Garbage & Sanitation',
  sewage: 'Sewage', electricity: 'Electricity', street_lights: 'Street Lights',
  traffic: 'Traffic', encroachment: 'Encroachment', pollution: 'Pollution',
  park_maintenance: 'Parks', building_safety: 'Building Safety', drainage: 'Drainage',
  public_transport: 'Public Transport', noise_complaint: 'Noise Complaint', other: 'Other'
};

export const CATEGORY_OPTIONS = [
  { value: 'roads_potholes', label: '🛣️ Roads / Potholes', dept: 'Roads & Infrastructure' },
  { value: 'water_supply', label: '💧 Water Supply', dept: 'Water Supply Board' },
  { value: 'garbage_sanitation', label: '🗑️ Garbage & Sanitation', dept: 'Sanitation & Waste' },
  { value: 'sewage', label: '🚰 Sewage', dept: 'Water Supply Board' },
  { value: 'electricity', label: '⚡ Electricity', dept: 'Electricity Department' },
  { value: 'street_lights', label: '💡 Street Lights', dept: 'Electricity Department' },
  { value: 'traffic', label: '🚦 Traffic', dept: 'Traffic Management' },
  { value: 'encroachment', label: '🏗️ Encroachment', dept: 'Building & Construction' },
  { value: 'pollution', label: '🌫️ Pollution', dept: 'Environment & Pollution' },
  { value: 'park_maintenance', label: '🌳 Park Maintenance', dept: 'Parks & Recreation' },
  { value: 'building_safety', label: '🏚️ Building Safety', dept: 'Building & Construction' },
  { value: 'drainage', label: '🌊 Drainage / Flooding', dept: 'Roads & Infrastructure' },
  { value: 'public_transport', label: '🚌 Public Transport', dept: 'Traffic Management' },
  { value: 'noise_complaint', label: '🔊 Noise Complaint', dept: 'Environment & Pollution' },
  { value: 'other', label: '📋 Other', dept: 'General' }
];

export const PRIORITY_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };

export const STATUS_LABELS = {
  submitted: 'Submitted', under_review: 'Under Review', assigned: 'Assigned',
  in_progress: 'In Progress', pending_verification: 'Pending Verification',
  resolved: 'Resolved', reopened: 'Reopened', rejected: 'Rejected', escalated: 'Escalated'
};

export const formatStatus = (status) => STATUS_LABELS[status] || status?.replace(/_/g, ' ');
export const formatCategory = (cat) => CATEGORY_LABELS[cat] || cat?.replace(/_/g, ' ');

export const getErrorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || fallback;

/**
 * Exports an array of objects to a downloadable CSV file.
 * Handles quoting/escaping per RFC 4180 so commas, quotes, and newlines
 * inside field values don't corrupt the file.
 */
export const exportToCSV = (rows, columns, filename = 'export.csv') => {
  const escape = (val) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const header = columns.map((c) => escape(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escape(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(','));
  const csv = [header, ...lines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const DATE_RANGE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: 'All Time', days: null }
];
