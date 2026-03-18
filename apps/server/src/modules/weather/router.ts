import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";

const querySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export const weatherRouter = Router();
weatherRouter.use(authGuard);

weatherRouter.get("/alerts", (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const hazard = parsed.data.lat > 45 ? "Cold weather advisory" : "Strong wind advisory";
  res.json({
    location: parsed.data,
    alerts: [
      { type: "weather", severity: "medium", message: hazard },
      { type: "road", severity: "low", message: "Road construction reported on nearby route" },
    ],
  });
});
