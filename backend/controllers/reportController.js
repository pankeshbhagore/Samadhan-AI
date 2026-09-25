const OpenAI = require('openai');
const Complaint = require('../models/Complaint');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// Initialize lazily to allow dynamic key injection if needed
let openai;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    try {
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } catch (e) {
      console.warn("OpenAI could not be initialized.");
    }
  }
  return openai;
}

exports.generatePressRelease = asyncHandler(async (req, res) => {
  const aiClient = getOpenAI();
  if (!aiClient) {
    return res.json({
      success: false,
      report: "OpenAI API key is not configured. Please add it to the .env file and restart the backend server."
    });
  }

  // Get resolved complaints from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { getStateFilter } = require('../middleware/stateFilter');
  const stateFilter = getStateFilter(req.user);
  if (req.user.role === 'department_head' && req.user.department) {
    stateFilter.department = req.user.department;
  }

  const resolvedComplaints = await Complaint.find({
    status: 'resolved',
    resolvedAt: { $gte: sevenDaysAgo },
    ...stateFilter
  }).populate('department', 'name').populate('assignedTo', 'name');

  if (resolvedComplaints.length === 0) {
    return res.json({
      success: true,
      report: "No complaints were resolved in the past 7 days to generate a report."
    });
  }

  // Summarize data for prompt
  const summaryData = resolvedComplaints.map(c => ({
    title: c.title,
    category: c.category,
    department: c.department?.name || 'N/A',
    resolutionTime: `${c.resolutionTimeHours} hours`,
    priority: c.priority,
    officer: c.assignedTo?.name || 'Unknown'
  }));

  let officeName = "State Admin's Office";
  let authorityName = "the government's";
  
  if (req.user.role === 'cm') {
    officeName = "Chief Minister's Office";
    authorityName = "the Chief Minister's";
  } else if (req.user.role === 'super_admin') {
    officeName = "National Administration Office";
    authorityName = "the Central Government's";
  } else if (req.user.role === 'department_head') {
    officeName = "Department Head's Office";
    authorityName = "the department's";
  }

  const prompt = `
    You are an expert Public Relations officer for the ${officeName}. 
    Write a highly professional, polished, and inspiring weekly press release summarizing ${authorityName} 
    efforts in resolving citizen grievances over the last 7 days.

    CRITICAL INSTRUCTIONS:
    1. DO NOT include any placeholders like "[Insert Date]", "[Name]", or "Date: XYZ". Write it as a final, ready-to-publish document.
    2. Read the raw data provided below. Group the achievements by department.
    3. Elegantly highlight 1-2 major successes (e.g. fastest resolutions, critical issues solved). 
    4. Mention 1 or 2 top-performing officers by name, but do NOT just dump a list of all officers.
    5. Format the output in clean Markdown. Use bolding and headers for visual appeal, but avoid excessive markdown characters. Keep it under 250 words.

    Here is the raw data of resolved complaints:
    ${JSON.stringify(summaryData, null, 2)}
  `;

  try {
    const stateName = req.user.state ? req.user.state : "India";
    const response = await aiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `You are an expert PR writer for the ${officeName} of ${stateName}.` },
      { role: 'user', content: prompt }
    ],
      temperature: 0.7,
    });

    const report = response.choices[0].message.content;

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('OpenAI Error:', error);
    throw new AppError('Failed to generate press release from OpenAI', 500);
  }
});
