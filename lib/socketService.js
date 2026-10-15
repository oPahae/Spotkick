import { io } from "socket.io-client";

let socket = null;
let currentToken = null;

export function connectSocket(token) {
  if (socket && currentToken === token) return socket;
  disconnectSocket();
  currentToken = token;
  socket = io({
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
  currentToken = null;
}

export function emitAck(event, payload, timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(Object.assign(new Error("You are not connected to the server."), { code: "NO_SOCKET" }));
      return;
    }
    if (!socket.connected) {
      reject(Object.assign(new Error("Connection lost. Reconnecting..."), { code: "DISCONNECTED" }));
      return;
    }
    socket.timeout(timeout).emit(event, payload || {}, (err, res) => {
      if (err) {
        reject(Object.assign(new Error("The server took too long to respond."), { code: "TIMEOUT" }));
        return;
      }
      if (res && res.ok) resolve(res);
      else reject(Object.assign(new Error((res && res.message) || "Request failed."), { code: res && res.error }));
    });
  });
}
