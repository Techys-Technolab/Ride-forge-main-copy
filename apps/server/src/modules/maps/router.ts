import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { createOfflinePack, listOfflinePacks } from "./repository";

const packSchema = z.object({
  name: z.string().min(2),
  minLat: z.number(),
  minLng: z.number(),
  maxLat: z.number(),
  maxLng: z.number(),
});

export const mapsRouter = Router();
mapsRouter.use(authGuard);

mapsRouter.get("/tile-manifest", (req, res) => {
  const lat = Number(req.query.lat ?? 0);
  const lng = Number(req.query.lng ?? 0);

  res.json({
    provider: "google_maps",
    online: true,
    region: { lat, lng },
    offlineHints: [
      "Download map packs before long-distance rides.",
      "Use low-zoom tiles for lower storage footprint.",
      "Keep at least 500MB free storage for multi-state coverage.",
    ],
  });
});

mapsRouter.post("/offline-packs", async (req, res) => {
  const parsed = packSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const latSpan = Math.abs(parsed.data.maxLat - parsed.data.minLat);
  const lngSpan = Math.abs(parsed.data.maxLng - parsed.data.minLng);
  const tileCountEstimate = Math.ceil((latSpan * lngSpan) * 10000);

  const created = await createOfflinePack({
    userId: req.auth!.userId,
    name: parsed.data.name,
    minLat: parsed.data.minLat,
    minLng: parsed.data.minLng,
    maxLat: parsed.data.maxLat,
    maxLng: parsed.data.maxLng,
    tileCountEstimate,
  });

  res.status(201).json({
    id: created.id,
    name: created.name,
    bounds: {
      minLat: Number(created.min_lat),
      minLng: Number(created.min_lng),
      maxLat: Number(created.max_lat),
      maxLng: Number(created.max_lng),
    },
    tileCountEstimate: Number(created.tile_count_estimate),
    createdAt: created.created_at,
  });
});

mapsRouter.get("/offline-packs", async (req, res) => {
  const rows = await listOfflinePacks(req.auth!.userId);
  res.json(
    rows.map((pack) => ({
      id: pack.id,
      name: pack.name,
      bounds: {
        minLat: Number(pack.min_lat),
        minLng: Number(pack.min_lng),
        maxLat: Number(pack.max_lat),
        maxLng: Number(pack.max_lng),
      },
      tileCountEstimate: Number(pack.tile_count_estimate),
      createdAt: pack.created_at,
    })),
  );
});
