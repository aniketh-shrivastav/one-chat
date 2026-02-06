import { io } from "socket.io-client";
import { getToken } from "./auth";

let socket;

export function initSocket() {
  const token = getToken();
  if (!token) return null;
  socket = io(process.env.REACT_APP_SOCKET_URL || "http://localhost:5000", {
    auth: { token },
    autoConnect: true,
  });
  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message);
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
}
