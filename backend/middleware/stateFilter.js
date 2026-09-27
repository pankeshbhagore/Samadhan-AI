/**
 * Middleware to generate a state filter based on the user's role and state.
 * This filter object can be passed directly to Mongoose queries.
 */
exports.getStateFilter = (user) => {
  if (!user) return {};

  // Super Admin can see everything across all states
  if (user.role === 'super_admin') {
    return {};
  }

  // Everyone else is restricted to their state
  const filter = {};
  if (user.state) {
    filter.state = user.state;
  }

  // Department heads are restricted to their department and state
  // They can see complaints where they are the primary department OR assigned a sub-task
  if (user.role === 'department_head') {
    const deptId = user.department?._id || user.department;
    filter.$or = [
      { department: deptId },
      { 'agenticPlan.department': deptId }
    ];
  }

  // Officers can see complaints assigned to them, OR where their DEPARTMENT has an agentic sub-task
  if (user.role === 'employee') {
    const deptId = user.department?._id || user.department;
    filter.$or = [
      { assignedTo: user._id },
      { 'agenticPlan.assignedTo': user._id }
    ];
    if (deptId) {
      filter.$or.push({ 'agenticPlan.department': deptId });
    }
  }

  // Citizens are restricted to their own complaints
  if (user.role === 'citizen') {
    filter.citizen = user._id;
  }

  return filter;
};
