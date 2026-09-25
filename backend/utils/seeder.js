require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const { Counter } = require('../models/Counter');
const statesData = require('./statesData');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/samadhan';

const departmentsTemplate = [
  { name: 'Roads & Infrastructure', code: 'ROADS', complaintCategories: ['roads_potholes', 'drainage'], slaHours: 48 },
  { name: 'Water Supply Board', code: 'WATER', complaintCategories: ['water_supply', 'sewage'], slaHours: 24 },
  { name: 'Sanitation & Waste', code: 'SANIT', complaintCategories: ['garbage_sanitation'], slaHours: 24 },
  { name: 'Electricity Department', code: 'ELEC', complaintCategories: ['electricity', 'street_lights'], slaHours: 12 },
  { name: 'Traffic Management', code: 'TRAFFIC', complaintCategories: ['traffic'], slaHours: 48 },
  { name: 'Environment & Pollution', code: 'ENV', complaintCategories: ['pollution', 'noise_complaint'], slaHours: 72 },
  { name: 'Parks & Recreation', code: 'PARKS', complaintCategories: ['park_maintenance'], slaHours: 96 },
  { name: 'Building & Construction', code: 'BUILD', complaintCategories: ['building_safety', 'encroachment'], slaHours: 24 },
  { name: 'Public Health', code: 'HEALTH', complaintCategories: ['other'], slaHours: 24 },
  { name: 'Public Transport', code: 'TRANSPORT', complaintCategories: ['public_transport'], slaHours: 48 }
];

const complaintTemplates = [
  { title: 'Large pothole on main road causing accidents', description: 'There is a massive pothole causing multiple accidents daily. Urgent repair needed.', category: 'roads_potholes', priority: 'high' },
  { title: 'Water supply disrupted for 3 days', description: 'No water supply for the past 3 days. Families are suffering especially during summer.', category: 'water_supply', priority: 'high' },
  { title: 'Garbage not collected for 2 weeks', description: 'Garbage has not been collected in our area for 2 weeks. Rotting waste is creating health hazard and foul smell.', category: 'garbage_sanitation', priority: 'medium' },
  { title: 'CRITICAL: Sewage overflow near school causing health risk', description: 'Sewage is overflowing near Government Primary School. Children are being exposed to raw sewage. EMERGENCY.', category: 'sewage', priority: 'critical', isCritical: true, criticalReason: 'sewage overflow school' },
  { title: 'Street lights not working in entire sector', description: 'All street lights are non-functional for a month. Area becomes pitch dark after sunset, creating safety issues.', category: 'street_lights', priority: 'high' },
  { title: 'Illegal construction blocking public road', description: 'Builder is constructing illegally on public land, blocking the road completely.', category: 'encroachment', priority: 'medium' },
  { title: 'Industrial smoke causing severe pollution', description: 'A factory is releasing black smoke 24x7 causing severe air pollution in residential areas nearby.', category: 'pollution', priority: 'high' },
  { title: 'CRITICAL: Building showing structural cracks may collapse', description: 'Residential building showing large cracks in walls and pillars. Residents fear collapse. Immediate inspection needed.', category: 'building_safety', priority: 'critical', isCritical: true, criticalReason: 'building collapse' },
  { title: 'Park benches broken, playing area unsafe for children', description: 'All benches and play equipment are broken and rusted, unsafe for children.', category: 'park_maintenance', priority: 'low' },
  { title: 'Traffic signal malfunctioning causing daily jams', description: 'Signal is stuck on red for 10+ minutes causing massive traffic jams during peak hours.', category: 'traffic', priority: 'high' },
  { title: 'Public bus route 42 highly irregular', description: 'The bus on route 42 has not been showing up on time for the past week.', category: 'public_transport', priority: 'medium' },
  { title: 'Mosquito breeding in stagnant water', description: 'Stagnant water in empty plot is causing heavy mosquito breeding.', category: 'other', priority: 'high' },
  { title: 'Drainage completely choked in market area', description: 'Market area is flooded due to choked drainage system.', category: 'drainage', priority: 'high' },
  { title: 'Loud music late night from commercial venue', description: 'Loud music played till 3 AM everyday violating noise rules.', category: 'noise_complaint', priority: 'medium' },
  { title: 'Electric pole leaning dangerously', description: 'Pole is leaning over the road, could fall anytime.', category: 'electricity', priority: 'critical', isCritical: true, criticalReason: 'pole leaning' }
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB...');

  await Promise.all([User.deleteMany(), Department.deleteMany(), Complaint.deleteMany(), Counter.deleteMany()]);
  console.log('Cleared existing data...');

  const password = await bcrypt.hash('password123', 12);
  const statuses = ['submitted', 'under_review', 'assigned', 'in_progress', 'pending_verification', 'resolved'];

  // 1 Global Super Admin
  await User.insertMany([{ name: 'Super Admin', email: 'admin@samadhan.gov.in', password, role: 'super_admin', designation: 'All India Administrator', isActive: true, state: null }]);
  console.log('Created Super Admin.');

  for (const stateObj of statesData) {
    const sc = stateObj.code.toLowerCase();
    
    // Create Departments for this state
    const depts = departmentsTemplate.map((d, i) => ({
      ...d,
      state: stateObj.code,
      mcd311DeptId: `DEPT-${sc}-${i+1}`,
      contactEmail: `${d.code.toLowerCase()}@${sc}.samadhan.gov.in`,
      contactPhone: `1800-${Math.floor(100000 + Math.random() * 900000)}`
    }));
    const createdDepts = await Department.insertMany(depts);

    // Create State Users
    let usersRaw = [
      { name: `${stateObj.name} CM`, email: `cm@${sc}.samadhan.gov.in`, password, role: 'cm', designation: `State Admin of ${stateObj.name}`, state: stateObj.code, isActive: true }
    ];

    // Add Dept Heads and Officers
    for (const [i, dept] of departmentsTemplate.entries()) {
      const dCode = dept.code.toLowerCase();
      // Dept Head
      usersRaw.push({
        name: `Head ${dept.name} ${stateObj.code}`, email: `dh.${dCode}@${sc}.samadhan.gov.in`, password, role: 'department_head', department: createdDepts[i]._id, designation: `Head - ${dept.name}`, bandwidth: 50, state: stateObj.code, isActive: true
      });
      // 5 Officers
      for (let j = 1; j <= 5; j++) {
        usersRaw.push({
          name: `Officer ${dept.name} ${j} ${stateObj.code}`, email: `officer${j}.${dCode}@${sc}.samadhan.gov.in`, password, role: 'employee', department: createdDepts[i]._id, designation: `Officer Level ${j}`, bandwidth: 20, state: stateObj.code, isActive: true
        });
      }
    }

    // Add Citizens
    for (let c = 1; c <= 10; c++) {
      usersRaw.push({
        name: `Citizen ${c} ${stateObj.code}`, email: `citizen${c}@${sc}.example.com`, password, role: 'citizen', ward: `Ward ${c}`, district: stateObj.districts[c % stateObj.districts.length], state: stateObj.code, isActive: true
      });
    }

    const users = await User.insertMany(usersRaw);

    // Link Dept Heads
    const deptHeads = users.filter(u => u.role === 'department_head');
    for (const [i, createdDept] of createdDepts.entries()) {
      const head = deptHeads.find(h => h.department.toString() === createdDept._id.toString());
      if (head) {
        await Department.findByIdAndUpdate(createdDept._id, { head: head._id });
      }
    }

    const citizens = users.filter((u) => u.role === 'citizen');
    const officers = users.filter((u) => u.role === 'employee');
    const complaints = [];

    // Create 150 complaints for this state
    for (let i = 0; i < 150; i++) {
      const tmpl = complaintTemplates[i % complaintTemplates.length];
      const baseCoords = stateObj.coords;
      const coords = [baseCoords[0] + (Math.random() - 0.5) * 0.1, baseCoords[1] + (Math.random() - 0.5) * 0.1];
      const deptIndex = i % createdDepts.length;
      const citizen = citizens[i % citizens.length];
      
      const eligibleOfficers = officers.filter(o => o.department.toString() === createdDepts[deptIndex]._id.toString());
      const officer = eligibleOfficers.length > 0 ? eligibleOfficers[i % eligibleOfficers.length] : undefined;
      
      const status = statuses[i % statuses.length];
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const isAssignedLike = ['assigned', 'in_progress', 'pending_verification', 'resolved'].includes(status) && !!officer;

      complaints.push({
        ...tmpl,
        state: stateObj.code,
        location: { type: 'Point', coordinates: coords },
        address: `Ward ${(i % 10) + 1}, ${stateObj.districts[i % stateObj.districts.length]}, ${stateObj.name}`,
        district: stateObj.districts[i % stateObj.districts.length],
        ward: `Ward ${(i % 10) + 1}`,
        citizen: citizen._id,
        department: createdDepts[deptIndex]._id,
        status,
        assignedTo: isAssignedLike ? officer._id : undefined,
        assignedAt: isAssignedLike ? createdAt : undefined,
        resolvedAt: status === 'resolved' ? new Date(createdAt.getTime() + 48 * 3600000) : undefined,
        resolutionTimeHours: status === 'resolved' ? 48 : undefined,
        dueDate: new Date(createdAt.getTime() + 72 * 3600000),
        source: ['portal', 'mobile_app', 'social_media'][i % 3],
        aiConfidence: 0.7 + Math.random() * 0.25,
        timeline: [{ status: 'submitted', message: 'Complaint submitted', updatedBy: citizen._id, timestamp: createdAt }],
        createdAt
      });
    }

    for (let i = 0; i < complaints.length; i += 50) {
      const batch = complaints.slice(i, i + 50);
      await Promise.all(batch.map(c => Complaint.create(c)));
    }

    console.log(`Seeded State: ${stateObj.name} (${stateObj.code}) with ${usersRaw.length} users and 150 complaints.`);
  }

  console.log('\n✅ SEED COMPLETE! Login credentials (password: password123):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Super Admin:  admin@samadhan.gov.in');
  console.log('CM (MH):      cm@mh.samadhan.gov.in');
  console.log('Dept Head:    dh.roads@mh.samadhan.gov.in');
  console.log('Officer:      officer1.roads@mh.samadhan.gov.in');
  console.log('Citizen:      citizen1@mh.example.com');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
