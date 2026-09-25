const OpenAI = require('openai');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { sendComplaintUpdatedEmail } = require('./emailService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Agentic AI Coordination Service
 * Analyzes a complaint to see if it requires multi-department coordination.
 * If so, generates a multi-step resolution plan.
 */
async function analyzeComplaintAgentically(complaintId) {
  try {
    const complaint = await Complaint.findById(complaintId).populate('department');
    if (!complaint) return;

    // Fetch all available departments to let the AI know who it can assign tasks to
    const departments = await Department.find({ state: complaint.state }).select('name _id');
    const deptList = departments.map(d => `${d.name} (ID: ${d._id})`).join(', ');

    const prompt = `
      You are an autonomous Agentic Decision Support System for Public Grievances.
      Your task is to analyze the following citizen complaint and determine if it is a "complex" grievance that requires multi-step planning or coordination across multiple departments.

      Complaint Title: "${complaint.title}"
      Complaint Description: "${complaint.description}"
      Reported Location/Address: "${complaint.address}"
      Current Primary Department: "${complaint.department?.name || 'Unassigned'}"

      Available Departments in the State:
      ${deptList}

      INSTRUCTIONS:
      1. Determine if this complaint involves multiple issues (e.g. fallen tree + power line down = Forestry + Electricity).
      2. If it is simple and only requires one department, set "isComplex" to false and provide a brief reasoning.
      3. If it is complex, set "isComplex" to true, and generate an "agenticPlan" consisting of sub-tasks.
      4. For each sub-task, assign an appropriate department ID from the list above.
      5. Identify if a task has a dependency (e.g. Power must be cut BEFORE tree is removed). Use task IDs (task_1, task_2) for this.
      6. If the information provided is completely inadequate to form a plan, or it involves something highly sensitive (e.g. severe crime), set "humanInterventionRequired" to true and explain why in "escalationReason".

      Return your response as a strictly valid JSON object with the following schema:
      {
        "isComplex": boolean,
        "agenticReasoning": "String explaining your analysis",
        "humanInterventionRequired": boolean,
        "escalationReason": "String explaining why a human is needed (if applicable, else empty)",
        "agenticPlan": [
          {
            "taskId": "task_1",
            "departmentId": "Department ObjectId",
            "taskDescription": "Specific action required",
            "dependency": "task_2" (optional, id of task that must complete first)
          }
        ]
      }
    `;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" }
    });

    const aiAnalysis = JSON.parse(response.choices[0].message.content);

    // Update the complaint
    complaint.isComplex = aiAnalysis.isComplex;
    complaint.agenticReasoning = aiAnalysis.agenticReasoning;
    complaint.humanInterventionRequired = aiAnalysis.humanInterventionRequired;
    complaint.escalationReason = aiAnalysis.escalationReason;

    const mongoose = require('mongoose');

    if (aiAnalysis.isComplex && aiAnalysis.agenticPlan && aiAnalysis.agenticPlan.length > 0) {
      complaint.agenticPlan = aiAnalysis.agenticPlan.map(task => {
        let validDeptId = null;
        if (task.departmentId && mongoose.Types.ObjectId.isValid(task.departmentId)) {
          validDeptId = task.departmentId;
        }

        return {
          taskId: task.taskId,
          department: validDeptId,
          taskDescription: task.taskDescription,
          status: 'pending',
          dependency: task.dependency || null
        };
      });
      // Auto-escalate if human intervention required or mark as 'assigned' if agentic plan is ready
      complaint.status = aiAnalysis.humanInterventionRequired ? 'escalated' : 'in_progress';
    }

    await complaint.save();
    return complaint;

  } catch (error) {
    console.error('Agentic Coordinator Error:', error);
  }
}

/**
 * Checks the status of subtasks and updates the main complaint status or triggers next steps.
 */
async function trackAndCoordinateProgress(complaintId) {
    const complaint = await Complaint.findById(complaintId);
    if(!complaint || !complaint.isComplex) return;

    let allCompleted = true;
    let anyBlocked = false;

    for (const task of complaint.agenticPlan) {
        if (task.status === 'blocked') anyBlocked = true;
        if (task.status !== 'completed') allCompleted = false;

        // Auto-unblock tasks if dependencies are met
        if(task.status === 'pending' && task.dependency) {
            const dependencyTask = complaint.agenticPlan.find(t => t.taskId === task.dependency);
            if(dependencyTask && dependencyTask.status === 'completed') {
                task.status = 'in_progress';
                // Trigger Socket.io notification to the department here in a real scenario
            }
        }
    }

    let statusChanged = false;
    let newStatus = complaint.status;
    let message = '';

    if(allCompleted) {
        // Must go to pending_verification first so the citizen can verify it (core feature)
        complaint.status = 'pending_verification';
        newStatus = 'pending_verification';
        message = 'All Agentic AI sub-tasks completed. Awaiting citizen verification.';
        complaint.timeline.push({ 
          status: 'pending_verification', 
          message, 
          isAutomatic: true 
        });
        statusChanged = true;
    } else if (anyBlocked && complaint.status !== 'escalated') {
        complaint.humanInterventionRequired = true;
        complaint.escalationReason = "A sub-task has been marked as blocked. Human intervention is required to resolve the dependency.";
        complaint.status = 'escalated';
        newStatus = 'escalated';
        message = complaint.escalationReason;
        statusChanged = true;
    }

    await complaint.save();
    
    if (statusChanged) {
        const citizen = await User.findById(complaint.citizen);
        if (citizen && citizen.email) {
            sendComplaintUpdatedEmail(
                citizen.email, 
                complaint.ticketId, 
                newStatus, 
                message
            ).catch(err => console.error(err));
        }
    }
    
    return complaint;
}

module.exports = { analyzeComplaintAgentically, trackAndCoordinateProgress };
