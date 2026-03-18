import { Server } from "socket.io";

export const registerRealtimeHandlers = (io: Server): void => {
  io.on("connection", (socket) => {
    socket.on("ride:join", (rideId: string) => {
      socket.join(`ride:${rideId}`);
    });

    socket.on("chat:join", (conversationId: string) => {
      socket.join(`chat:${conversationId}`);
    });

    socket.on("order:join", (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on(
      "ride:location",
      (payload: { rideId: string; userId: string; lat: number; lng: number; speed?: number; ts: string }) => {
        io.to(`ride:${payload.rideId}`).emit("ride:location:update", payload);
      },
    );

    socket.on("disconnect", () => {
      // no-op for now; useful hook for presence tracking
    });
  });
};
