# 🏛️ Samadhan: AI-Driven Public Grievance Intelligence Dashboard

![MERN Stack](https://img.shields.io/badge/Stack-MERN-blue?style=for-the-badge&logo=react)
![Socket.io](https://img.shields.io/badge/RealTime-Socket.io-black?style=for-the-badge&logo=socket.io)
![Node.js](https://img.shields.io/badge/Backend-Node.js-green?style=for-the-badge&logo=node.js)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-darkgreen?style=for-the-badge&logo=mongodb)

> **"Closing the Loophole in E-Governance through AI, Geo-Fencing, and Citizen Verification"**

**Samadhan** is a next-generation, intelligent public grievance management system. It acts as a direct bridge between citizens and government departments, leveraging Artificial Intelligence, strict geographic accountability, and real-time tracking to ensure that public complaints are not just recorded, but actively and honestly resolved.

---

## 🛑 The Problem
Current e-governance systems suffer from severe critical flaws:
1. **The "False Closure" Loophole:** Corrupt or lazy officials often mark complaints (like a broken pipe or pothole) as "Resolved" from their desks without ever visiting the site or doing the physical work.
2. **Opaque Tracking:** Citizens are kept in the dark after submitting a complaint.
3. **Manual Routing Delays:** Complaints sit in pending queues for days waiting for a human to route them to the correct local department.
4. **Lack of Accountability:** Higher-ups (Chief Ministers, Admins) lack micro-level data to track which specific officers or contractors are failing their Service Level Agreements (SLAs).

---

## 💡 The Solution (Key Features)

### 1. 🛡️ The Ultimate Loophole Closer: Citizen Verification
A ticket can **never** be officially closed by an officer alone. When an officer marks a job as "Completed", the system emails the Citizen with photographic evidence of the fixed issue. The citizen must manually click **Verify & Accept** on their dashboard. If they click **Reject**, the ticket is instantly reopened, and the officer is penalized.

### 2. 📍 Geo-Fencing Accountability
When an officer attempts to upload a "Proof of Resolution" photo, the application captures their device's GPS coordinates. If the officer is more than **300 meters** away from the exact location of the citizen's original complaint, a "Geo-Fence Violation" is triggered, logging a suspicious audit trail for the Super Admin.

### 3. 🤖 AI Image Fraud Detection (Perceptual Hashing)
To prevent an officer from uploading the exact same stock photo of a "fixed pothole" to close 50 different tickets, the backend utilizes **Jimp** to generate a perceptual hash of the uploaded image. It compares this hash against the last 1,000 resolved tickets. Visually identical images instantly trigger an AI Fraud Alert.

### 4. 🧠 Automated AI Department Routing
The system uses Natural Language Processing to instantly read a citizen's complaint description and automatically route it to the exact correct department (e.g., Water Board, PWD, Electricity) within milliseconds.

### 5. 📊 Automated Real-Time Analytics
A scheduled CRON service automatically generates weekly, monthly, and yearly performance reports, sending deep analytical insights directly to Department Heads and State Admins.

---

## 🏆 Hackathon Agentic AI Challenges Implemented

### Challenge 1: Real-Time Circuit Breaker via OpenTelemetry Tracing
**Problem:** Implement an execution circuit breaker that leverages an observability framework (e.g., OpenTelemetry or LangSmith) to actively monitor an agent's loop iterations and token consumption in real-time. The backend must intercept the workflow and halt execution when a predefined threshold (such as 4 consecutive failed tool calls or a maximum token budget) is breached, gracefully degrading the system rather than entering an infinite loop.
**Solution (Expected Outcome Achieved):** 
- **Telemetry Pipeline:** Integrated `@opentelemetry/api` in `agenticCoordinator.js` to create spans (`agent-loop-tracer`) that capture real-time metrics for LLM calls, loop iterations, and token usage during the multi-department plan generation.
- **Circuit Breaker Logic:** Implemented a custom `CircuitBreaker` utility that monitors iterations. If the AI exceeds 4 consecutive JSON parsing failures, 10 iterations, or a 5000 token budget, it trips and immediately halts the runaway loop without crashing the Node.js process.
- **Structured Error Trace:** Upon tripping, the agent explicitly logs a structured trace (including `traceId`, `triggerNode`, `reason`, and `failureCount`) and gracefully degrades by auto-escalating the complex complaint to a human supervisor.

### Challenge 2: State-Preserving Human-in-the-Loop (HITL) Handoff
**Problem:** Build an asynchronous human approval gate for irreversible agent actions (e.g., external API triggers or database mutations). The system must pause the autonomous agent's execution, serialize its current context and proposed tool parameters into a persistent data store, and expose an endpoint for a human operator to approve, modify, or reject the action before the agent resumes.
**Solution (Expected Outcome Achieved):**
- **State Serialization:** When the `agenticCoordinator` generates a complex multi-step resolution plan (involving multiple departments), it pauses execution. It serializes the proposed JSON plan and context, saving it to MongoDB via the `HitlRequest` model.
- **Human Approval Gate UI:** The application exposes an endpoint (`/api/hitl/pending`) and a dedicated Frontend interface (`HitlReviewBoard.js` on the Admin Dashboard) where a human reviewer can view the agent's proposed departments and tasks.
- **Resumption & Adaptation:** The Admin can approve, edit, or reject the plan. Once approved, the system seamlessly resumes the workflow by creating the sub-tasks and triggering the irreversible database mutations and viaSocket email notifications.

---

## 🛠️ Technology Stack

### Frontend (Client-Side)
- **React.js (v18):** Component-based UI rendering.
- **Context API:** Global state management for authentication and notifications.
- **CSS3:** Custom, responsive, mobile-first styling (No heavy CSS frameworks required).

### Backend (Server-Side)
- **Node.js & Express.js:** RESTful API architecture.
- **Socket.io:** WebSockets for instant, real-time event streaming and notifications.
- **Jimp:** Image processing and perceptual hashing for fraud detection.
- **Nodemailer:** Automated HTML email timelines and citizen verification loops.
- **node-cron:** Scheduled task execution for analytics reporting.

### Database
- **MongoDB:** NoSQL document database.
- **Mongoose:** Object Data Modeling (ODM) library.

---

## 🚀 System Architecture Flow

1. **Submission:** Citizen submits a complaint with GPS location and photos.
2. **AI Triage:** System instantly assigns the ticket to the relevant local officer.
3. **Execution:** Officer receives the ticket, travels to the site, performs the work, and uploads "Proof Images" via the portal.
4. **Fraud Check:** Backend validates GPS proximity and AI checks for image duplicates. 
5. **Citizen Verification:** An email containing the proof photos is sent to the citizen. The ticket is placed in "Pending Verification".
6. **Finality:** The citizen reviews the photos. If they click "Reject", the officer is penalized and the ticket reopens. If "Accept", the ticket is officially closed.

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (Local instance or MongoDB Atlas)
- Gmail Account (for Nodemailer SMTP)

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/your-username/samadhan-ai.git
cd samadhan-ai
\`\`\`

### 2. Backend Setup
\`\`\`bash
cd backend
npm install
\`\`\`
Create a \`.env\` file in the \`backend\` directory:
\`\`\`env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/samadhan
JWT_SECRET=your_super_secret_jwt_key
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:3000
API_URL=http://localhost:5000
\`\`\`
Run the backend:
\`\`\`bash
npm run dev
\`\`\`

### 3. Frontend Setup
Open a new terminal window:
\`\`\`bash
cd frontend
npm install
\`\`\`
Create a \`.env\` file in the \`frontend\` directory:
\`\`\`env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
\`\`\`
Run the frontend:
\`\`\`bash
npm start
\`\`\`

---

## 🔮 Future Scope
- **WhatsApp Bot Integration:** Allow citizens to submit and verify complaints entirely through WhatsApp to increase rural accessibility.
- **Predictive Infrastructure Maintenance:** Use AI to analyze clusters of complaints to predict where a pipeline might burst *before* it happens.
- **Multilingual Voice Analysis:** Allow citizens to call a toll-free number, with AI instantly transcribing regional languages into actionable text tickets.

---

## 📄 License
This project is licensed under the MIT License. Developed for Hack Indore.
