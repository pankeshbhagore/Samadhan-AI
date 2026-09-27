const OpenAI = require('openai');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { sendComplaintUpdatedEmail, sendOfficerAssignedEmail } = require('./emailService');

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
      5. CRITICAL SAFETY RULE: Carefully consider logical SAFETY and PREREQUISITE dependencies. If there is a hazard (e.g. live electricity, fire), the department responsible for neutralizing the hazard MUST go first. For example, if a tree falls on power lines, the Electricity Department MUST cut the power (Task 1) BEFORE the Environment department can safely remove the tree (Task 2).
      6. For any task that cannot start until another task is finished, set its "dependency" field to the "taskId" of the prerequisite task.
      7. If the information provided is completely inadequate to form a plan, or it involves something highly sensitive (e.g. severe crime), set "humanInterventionRequired" to true and explain why in "escalationReason".

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

    const { tracer } = require('../utils/telemetry');
    const { CircuitBreaker, CircuitBreakerTripError } = require('../utils/circuitBreaker');
    const { SpanStatusCode } = require('@opentelemetry/api');

    // Initialize Circuit Breaker (4 failures max)
    const breaker = new CircuitBreaker({ maxConsecutiveFailures: 4, maxTokens: 5000, maxIterations: 10 });
    let response;
    let aiAnalysis = null;
    let isSuccess = false;

    await tracer.startActiveSpan('analyze_complaint_agentically', async (span) => {
      span.setAttribute('complaint.id', complaintId);
      
      try {
        while (!isSuccess) {
          try {
            breaker.state.iterations++;
            span.setAttribute('iteration', breaker.state.iterations);

            response = await openai.chat.completions.create({
              model: process.env.OPENAI_MODEL || "gpt-4o",
              messages: [{ role: "system", content: prompt }],
              response_format: { type: "json_object" }
            });

            aiAnalysis = JSON.parse(response.choices[0].message.content);
            const tokens = response.usage?.total_tokens || 800;
            
            breaker.recordLLMCall(tokens);
            breaker.recordToolCall(true, 'analyzeComplaintAgentically', span.spanContext());
            
            span.setAttribute('tokens.used', tokens);
            isSuccess = true;
          } catch (apiError) {
            span.addEvent('tool_call_failed', { error: apiError.message, iteration: breaker.state.iterations });
            breaker.recordToolCall(false, 'analyzeComplaintAgentically', span.spanContext());
            // If breaker hasn't tripped, loop will retry
          }
        }
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        if (err instanceof CircuitBreakerTripError) {
          span.addEvent('CIRCUIT_BREAKER_TRIPPED', err.tripRecord);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          
          console.error(JSON.stringify({
            traceId: err.tripRecord.traceId,
            event: "CIRCUIT_BREAKER_TRIPPED",
            haltedAt: {
              node: err.tripRecord.triggerNode,
              reason: err.tripRecord.reason,
              failureCount: err.tripRecord.failureCount,
              complaintId: complaintId
            },
            gracefulAction: "complaint_auto_escalated"
          }, null, 2));

          // Graceful Degradation
          aiAnalysis = {
            isComplex: true,
            humanInterventionRequired: true,
            escalationReason: `AI Circuit Breaker: ${err.tripRecord.reason}`,
            agenticPlan: []
          };
        } else {
          throw err;
        }
      } finally {
        span.end();
      }
    });

    // Update the complaint
    complaint.isComplex = aiAnalysis.isComplex;
    complaint.agenticReasoning = aiAnalysis.agenticReasoning;
    complaint.humanInterventionRequired = aiAnalysis.humanInterventionRequired;
    complaint.escalationReason = aiAnalysis.escalationReason;

    const mongoose = require('mongoose');

    if (aiAnalysis.isComplex && aiAnalysis.agenticPlan && aiAnalysis.agenticPlan.length > 0) {
      const formattedPlan = aiAnalysis.agenticPlan.map(task => {
        let validDeptId = null;
        if (task.departmentId && mongoose.Types.ObjectId.isValid(task.departmentId)) {
          validDeptId = task.departmentId;
        }
        return {
          taskId: task.taskId,
          department: validDeptId,
          taskDescription: task.taskDescription,
          status: 'pending',
          dependency: task.dependency || null,
          assignedTo: null
        };
      });

      // HITL GATE: PAUSE HERE
      const HitlRequest = require('../models/HitlRequest');
      await HitlRequest.create({
        complaintId: complaint._id,
        type: 'CREATE_PLAN',
        contextData: { reason: complaint.agenticReasoning, humanInterventionRequired: complaint.humanInterventionRequired },
        proposedAction: formattedPlan,
        status: 'pending'
      });

      complaint.status = 'pending_hitl_approval';
    } else {
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
    } else if (anyBlocked && complaint.status !== 'escalated' && complaint.status !== 'pending_hitl_approval') {
        const HitlRequest = require('../models/HitlRequest');
        await HitlRequest.create({
          complaintId: complaint._id,
          type: 'ESCALATION',
          contextData: { reason: "A sub-task has been marked as blocked. Human intervention is required to resolve the dependency." },
          status: 'pending'
        });
        
        complaint.status = 'pending_hitl_approval';
        newStatus = 'pending_hitl_approval';
        message = 'Task blocked. Awaiting administrative review for escalation.';
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

/**
 * Attempts to dynamically replan subtasks when a task is blocked.
 */
async function replanComplaintAgentically(complaintId, blockedTaskId, blockReason) {
  try {
    const complaint = await Complaint.findById(complaintId).populate('department');
    if (!complaint || !complaint.isComplex) return;

    const departments = await Department.find({ state: complaint.state }).select('name _id');
    const deptList = departments.map(d => `${d.name} (ID: ${d._id})`).join(', ');

    const currentPlanStr = JSON.stringify(complaint.agenticPlan.map(t => ({
      taskId: t.taskId,
      departmentId: t.department,
      taskDescription: t.taskDescription,
      status: t.status,
      dependency: t.dependency
    })));

    const prompt = `
      You are an autonomous Agentic Decision Support System for Public Grievances.
      A previously generated plan to resolve a complex grievance has encountered a roadblock.
      
      Original Complaint Title: "${complaint.title}"
      Original Complaint Description: "${complaint.description}"
      
      Available Departments:
      ${deptList}
      
      Current Plan State:
      ${currentPlanStr}
      
      The task with ID "${blockedTaskId}" has been marked as BLOCKED by the assigned officer.
      Reason given by the officer for this block: "${blockReason}"
      
      INSTRUCTIONS:
      1. Analyze if this roadblock can be bypassed by adding new tasks, changing dependencies, or routing to a different department.
      2. If it can be bypassed, set "canReplan" to true, and output a completely revised "agenticPlan". Ensure you include the previously completed tasks so the system doesn't lose track of them.
      3. If the roadblock is insurmountable without a human supervisor (e.g. requires a budget approval, legal action, or is impossible to fix), set "canReplan" to false, and explain why in "escalationReason".
      
      Return strictly valid JSON:
      {
        "canReplan": boolean,
        "agenticReasoning": "String explaining how you adapted the plan or why you couldn't",
        "escalationReason": "String explaining why a human is needed (if canReplan is false)",
        "agenticPlan": [
          {
            "taskId": "task_1",
            "departmentId": "Department ObjectId",
            "taskDescription": "Specific action required",
            "status": "completed|in_progress|pending",
            "dependency": "task_2" (optional)
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
    
    // Log the AI replanning decision
    complaint.timeline.push({ 
      status: 'in_progress', 
      message: `Agentic AI Re-evaluation triggered by blocked task. AI concluded: ${aiAnalysis.agenticReasoning}`,
      isAutomatic: true 
    });

    if (aiAnalysis.canReplan && aiAnalysis.agenticPlan && aiAnalysis.agenticPlan.length > 0) {
      const mongoose = require('mongoose');
      complaint.agenticPlan = aiAnalysis.agenticPlan.map(task => {
        let validDeptId = null;
        if (task.departmentId && mongoose.Types.ObjectId.isValid(task.departmentId)) {
          validDeptId = task.departmentId;
        }

        return {
          taskId: task.taskId,
          department: validDeptId,
          taskDescription: task.taskDescription,
          status: task.status || 'pending',
          dependency: task.dependency || null
        };
      });
      
      complaint.agenticReasoning = aiAnalysis.agenticReasoning;
      complaint.status = 'in_progress'; // Unblocked!
      
    } else {
      complaint.humanInterventionRequired = true;
      complaint.escalationReason = aiAnalysis.escalationReason || "Agentic AI could not find a workaround for the blocked task.";
      complaint.status = 'escalated';
    }

    await complaint.save();
    return complaint;
  } catch (error) {
    console.error('Agentic Coordinator Replanning Error:', error);
  }
}

module.exports = { analyzeComplaintAgentically, trackAndCoordinateProgress, replanComplaintAgentically };
