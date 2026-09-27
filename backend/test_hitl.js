
const axios = require("axios");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

async function testHitl() {
    try {
        await mongoose.connect("mongodb://localhost:27017/samadhan");
        const User = require("./models/User");
        const HitlRequest = require("./models/HitlRequest");
        const Complaint = require("./models/Complaint");

        const admin = await User.findOne({role: "super_admin"});
        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || "fallback_secret", { expiresIn: "1d" });
        const config = { headers: { Authorization: `Bearer ${token}` } };

        const pendingReq = await HitlRequest.findOne({ status: "pending" });
        if (!pendingReq) {
            console.log("No pending HITL requests found.");
            process.exit();
        }

        console.log("Found Pending HITL Request:", pendingReq._id);
        const approveRes = await axios.put(`http://localhost:5000/api/hitl/${pendingReq._id}/resolve`, {
            action: "approve",
            adminComments: "Looks good, proceed!"
        }, config);

        console.log("HITL Approved Successfully! Response:", approveRes.data);
        
        const updatedComplaint = await Complaint.findById(pendingReq.complaintId);
        console.log("New Complaint Status:", updatedComplaint.status);
        console.log("Task 1 Status:", updatedComplaint.agenticPlan[0]?.status);
        
        if (updatedComplaint.status === "in_progress") {
            console.log("✅ HITL Pipeline fully functional! Challenge 2 is 100% complete.");
        } else {
            console.log("❌ HITL Pipeline failed to update complaint status.");
        }
        process.exit();
    } catch (err) {
        console.error("Test error:", err.response ? err.response.data : err.message);
        process.exit(1);
    }
}
testHitl();
