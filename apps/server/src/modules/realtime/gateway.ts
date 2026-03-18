import { Server } from "socket.io";

let io: Server | null = null;

export function setIoServer(server: Server): void {
  io = server;
}

export function getIoServer(): Server | null {
  return io;
}
