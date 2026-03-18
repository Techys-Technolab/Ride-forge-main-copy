import { createServer } from "http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { env } from "./config/env";
import { registerRealtimeHandlers } from "./modules/realtime/socket";
import { initRedis } from "./db/redis";
import { pg } from "./db/pg";
import { setIoServer } from "./modules/realtime/gateway";
import { initFirebasePush } from "./services/firebase";

async function bootstrap() {
  await pg.query("SELECT 1");
  await initRedis();
  initFirebasePush();

  const app = createApp();
  const server = createServer(app);

  const io = new Server(server, {
    cors: { origin: env.corsOrigin },
  });
  setIoServer(io);
  registerRealtimeHandlers(io);

  server.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap server", error);
  process.exit(1);
});
