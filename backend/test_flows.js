
const axios = require("axios");
const mongoose = require("mongoose");
const baseUrl = "http://localhost:5000/api";

async function testFlows() {
    try {
        console.log("1. Logging in...");
        const loginRes = await axios.post(`${baseUrl}/auth/login`, {
            email: "priyankparsai2510@gmail.com",
            password: "Pankesh@123"
        });
        const token = loginRes.data.token;
        console.log("Logged in successfully. Token received.");
        const config = { headers: { Authorization: `Bearer ${token}` } };

        console.log("\n2. Testing Simple Complaint...");
        const simplePayload = {
            title: "Street light is broken",
            description: "The street light in front of house 10 has been broken for 3 days.",
            address: "Test Address, Indore",
            category: "street_lights",
            priority: "low",
            source: "portal"
        };
        const simpleRes = await axios.post(`${baseUrl}/complaints`, simplePayload, config);
        console.log("Simple Complaint Created! ID:", simpleRes.data.complaint._id);
        console.log("Status:", simpleRes.data.complaint.status);
        console.log("IsComplex:", simpleRes.data.complaint.isComplex);
        if (simpleRes.data.complaint.status === "assigned") {
            console.log("✅ SUCCESS: Simple complaint auto-assigned properly.");
        } else {
            console.log("❌ FAILED: Simple complaint status is not assigned. It is:", simpleRes.data.complaint.status);
        }

        console.log("\n3. Testing Complex Complaint...");
        const complexPayload = {
            title: "Massive fire and electrical wire broken",
            description: "A huge fire broke out near the transformer and wires are falling on the road.",
            address: "Transformer Lane, Indore",
            category: "electricity",
            priority: "critical",
            source: "portal"
        };
        const complexRes = await axios.post(`${baseUrl}/complaints`, complexPayload, config);
        console.log("Complex Complaint Created! ID:", complexRes.data.complaint._id);
        console.log("Status:", complexRes.data.complaint.status);
        console.log("IsComplex:", complexRes.data.complaint.isComplex);
        
        if (complexRes.data.complaint.status === "pending_hitl_approval") {
            console.log("✅ SUCCESS: Complex complaint paused for HITL approval properly.");
        } else {
            console.log("❌ FAILED: Complex complaint status is not pending_hitl_approval. It is:", complexRes.data.complaint.status);
        }

    } catch (err) {
        console.error("Test script error:", err.response ? err.response.data : err.message);
    }
}
testFlows();
