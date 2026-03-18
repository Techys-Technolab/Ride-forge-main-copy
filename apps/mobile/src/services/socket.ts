import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../state/authStore";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().accessToken;
    socket = io(API_URL, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
    });
  }

  return socket;
}

export function closeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
