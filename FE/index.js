/**
 * 1. LOGIN LOGIC
 * This section handles the browser-only login
 */
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('http://localhost:3000/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.data && result.data.token) {
            // Save the token to local storage
            localStorage.setItem("accessToken", result.data.token);
            localStorage.setItem("authPrefix", result.data.prefix);
            console.log("[FRONTEND] 💾 Token saved! Reloading to connect socket...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Optional: Small delay to ensure token is saved before reload
            location.reload(); // Reload to trigger the Socket.IO connection with the new token
        } else {
            alert("Login Failed: " + (result.message || "Unknown error"));
        }
    } catch (err) {
        console.error("Login Error:", err);
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authPrefix");
    location.reload();
});

/**
 * 2. SOCKET.IO LOGIC
 */
const token = localStorage.getItem("accessToken"); 
const prefix = localStorage.getItem("authPrefix");

if (!token) {
    document.getElementById('status').innerText = "Logged out. Please login to connect.";
} else {
const socket = io("http://localhost:3000", {
    auth: {
        // Use the prefix stored during login (e.g., "Bearer" or "Admin")
        authorization: `${prefix} ${token}`
    }
});

socket.on("connect", () => {
    document.getElementById('status').innerText = "Connected as " + socket.id;
    addLog(`✅ Connected! Socket ID: ${socket.id}`);
    console.log("[FRONTEND] ✅ Socket.IO: Successfully connected! My Socket ID is:", socket.id);
    
    // Save our socketId to localStorage so we can use it in events
    localStorage.setItem("socketId", socket.id);
});

// GUI INTERACTION LOGIC
const eventSelector = document.getElementById('event-type');
const targetInput = document.getElementById('target-id');
const msgInput = document.getElementById('socket-msg');

eventSelector.addEventListener('change', (e) => {
    // Show target input only for Room or Private messages
    const showTarget = ['room', 'private'].includes(e.target.value);
    targetInput.style.display = showTarget ? 'block' : 'none';
});

document.getElementById('send-socket-btn').addEventListener('click', () => {
    const type = eventSelector.value;
    const msg = msgInput.value || "Default Message";
    const target = targetInput.value;

    addLog(`📤 Sending ${type}...`);

    if (type === 'hi') {
        socket.emit("hi", { id: socket.id, message: msg });
    } else if (type === 'broadcast') {
        socket.emit("broadcastExample", { message: msg });
    } else if (type === 'room') {
        socket.emit("joinRoom", target || "general");
    } else if (type === 'private') {
        socket.emit("privateMessage", { targetId: target, message: msg });
    } else if (type === 'admin') {
        adminSocket.emit("adminCommand", { action: msg });
    }
});

socket.on("sayHiBack", (data) => {
    addLog(`📥 sayHiBack: ${JSON.stringify(data)}`);
    console.log("[FRONTEND] 📥 Socket.IO: Received 'sayHiBack' response from server:", data);
});

// Listeners for the new communication patterns
socket.on("globalAnnouncement", (data) => {
    addLog(`📣 BROADCAST: ${data.message} from ${data.sender}`);
    console.log("[FRONTEND] 📣 BROADCAST Received:", data);
});

socket.on("roomUpdate", (message) => {
    addLog(`👥 ROOM UPDATE: ${message}`);
    console.log("[FRONTEND] 👥 MULTICAST (Room Update):", message);
});

socket.on("directMessage", (data) => {
    addLog(`📨 PRIVATE from ${data.from}: ${data.message}`);
    console.log(`[FRONTEND] 📨 PRIVATE MESSAGE from ${data.from}:`, data.message);
});

socket.on("disconnect", () => {
    document.getElementById('status').innerText = "Disconnected";
    console.log("[FRONTEND] ⚠️ Socket.IO: Connection to server lost.");
});

// Helper to add logs to the UI
function addLog(msg) {
    const logContent = document.getElementById('log-content');
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContent.prepend(div);
}

// --- MULTIPLEXING EXAMPLE: Connecting to Admin Namespace ---
// This uses the SAME physical connection as the first one
// We must provide the same auth object so the admin middleware can verify us
const adminSocket = io("http://localhost:3000/admin", {
    auth: {
        authorization: `${prefix} ${token}`
    }
});

adminSocket.on("connect", () => {
    addLog("🛡️ Admin Namespace Connected");
    console.log("[FRONTEND] 🛡️ Admin Namespace: Connected successfully!");
});

adminSocket.on("adminResponse", (data) => {
    addLog(`📥 Admin Response: ${JSON.stringify(data)}`);
    console.log("[FRONTEND] 📥 Admin Namespace: Received response:", data);
});
}