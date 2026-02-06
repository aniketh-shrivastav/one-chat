const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const User = require("./models/User");
const path = require("path");
const fs = require("fs");
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  },
});

// Keep a map of userId -> socket ids (support multi-device)
const userSockets = new Map();

function addUserSocket(userId, socketId) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socketId);
}
function removeUserSocket(userId, socketId) {
  if (!userSockets.has(userId)) return;
  const set = userSockets.get(userId);
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(userId);
}
function emitToUser(userId, event, payload) {
  const set = userSockets.get(userId);
  if (!set) return;
  for (const sid of set) io.to(sid).emit(event, payload);
}

// Expose simple pub helper for routes
app.set("emitToUser", emitToUser);
app.set("io", io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error("No auth token"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (e) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  addUserSocket(socket.userId, socket.id);
  // Fetch user to check hidePresence
  let userDoc = await User.findById(socket.userId)
    .select("hidePresence status")
    .lean()
    .catch(() => null);
  const hidePresence = userDoc?.hidePresence;
  // Mark user online if not hiding
  if (!hidePresence) {
    User.findByIdAndUpdate(socket.userId, { status: "online" }).catch(() => {});
    io.emit("presence:update", { userId: socket.userId, status: "online" });
  } else {
    // For the connecting user, still tell them they are online (self-awareness) via a self event
    socket.emit("presence:self", {
      userId: socket.userId,
      status: "online",
      hidden: true,
    });
  }
  socket.emit("connection:ack", { userId: socket.userId });
  socket.on("disconnect", async () => {
    const had = userSockets.get(socket.userId);
    removeUserSocket(socket.userId, socket.id);
    const still = userSockets.get(socket.userId);
    if (!still) {
      // No more active sockets for this user
      const u = await User.findById(socket.userId)
        .select("hidePresence")
        .lean()
        .catch(() => null);
      if (!u?.hidePresence) {
        User.findByIdAndUpdate(socket.userId, { status: "offline" }).catch(
          () => {}
        );
        io.emit("presence:update", {
          userId: socket.userId,
          status: "offline",
        });
      } else {
        socket.emit("presence:self", {
          userId: socket.userId,
          status: "offline",
          hidden: true,
        });
      }
    }
  });
});

app.use(express.json());
app.use(cors());
// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

function startServer(
  startPort = Number(process.env.PORT) || 5000,
  attempt = 0
) {
  const port = startPort + attempt;
  server.listen(port, () => {
    console.log(`Server + Socket.IO running on port ${port}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt < 5) {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      setTimeout(() => startServer(startPort, attempt + 1), 300);
    } else if (err.code === "EADDRINUSE") {
      console.error(
        `All attempted ports (${startPort} - ${
          startPort + attempt
        }) are in use. Set PORT env to a free port.`
      );
      process.exit(1);
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
