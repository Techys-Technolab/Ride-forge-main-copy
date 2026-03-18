import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/router";
import { ridesRouter } from "./modules/rides/router";
import { routesRouter } from "./modules/routes/router";
import { socialRouter } from "./modules/social/router";
import { eventsRouter } from "./modules/events/router";
import { subscriptionsRouter } from "./modules/subscriptions/router";
import { weatherRouter } from "./modules/weather/router";
import { chatRouter } from "./modules/chat/router";
import { storeRouter } from "./modules/store/router";
import { challengesRouter } from "./modules/challenges/router";
import { rewardsRouter } from "./modules/rewards/router";
import { mapsRouter } from "./modules/maps/router";
import { notificationsRouter } from "./modules/notifications/router";
import { clubsRouter } from "./modules/clubs/router";
import { profileRouter } from "./modules/profile/router";
import { rateLimit } from "./middleware/rateLimit";

export const createApp = () => {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use("/api/subscriptions/webhook", express.raw({ type: "application/json" }));
  app.use("/api/store/webhook", express.raw({ type: "application/json" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.use(rateLimit({ keyPrefix: "rl:global", limit: 500, windowSec: 60 }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "rideforge-api" });
  });

  app.use("/api/auth", rateLimit({ keyPrefix: "rl:auth", limit: 80, windowSec: 60 }), authRouter);
  app.use("/api/rides", ridesRouter);
  app.use("/api/routes", routesRouter);
  app.use("/api/social", socialRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/subscriptions", subscriptionsRouter);
  app.use("/api/weather", weatherRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/store", storeRouter);
  app.use("/api/challenges", challengesRouter);
  app.use("/api/rewards", rewardsRouter);
  app.use("/api/maps", mapsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/clubs", clubsRouter);
  app.use("/api/profile", profileRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
};
