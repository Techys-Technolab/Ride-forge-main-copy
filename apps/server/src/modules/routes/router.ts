import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { authGuard } from "../../middleware/auth";
import { createRoute, favoriteRoute, getRouteById, listFavoriteRoutes, listRoutes } from "./repository";
import { delCache, getJsonCache, setJsonCache } from "../../db/cache";

const waypointSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  lat: z.number(),
  lng: z.number(),
  hazard: z.string().optional(),
});

const createRouteSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  waypoints: z.array(waypointSchema).min(2),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(true),
});

export const routesRouter = Router();

routesRouter.use(authGuard);

routesRouter.post("/", async (req, res) => {
  const parsed = createRouteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const route = await createRoute({
    creatorId: req.auth!.userId,
    name: parsed.data.name,
    description: parsed.data.description,
    tags: parsed.data.tags,
    isPublic: parsed.data.isPublic,
    waypoints: parsed.data.waypoints.map((w) => ({ ...w, id: w.id ?? uuid() })),
  });

  await delCache(`routes:${req.auth!.userId}`);
  res.status(201).json({
    id: route.id,
    creatorId: route.creator_id,
    name: route.name,
    description: route.description,
    waypoints: route.waypoints,
    tags: route.tags,
    isPublic: route.is_public,
  });
});

routesRouter.get("/", async (req, res) => {
  const cacheKey = `routes:${req.auth!.userId}`;
  const cached = await getJsonCache<unknown[]>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const data = await listRoutes(req.auth!.userId);
  const payload = data.map((route) => ({
    id: route.id,
    creatorId: route.creator_id,
    name: route.name,
    description: route.description,
    waypoints: route.waypoints,
    tags: route.tags,
    isPublic: route.is_public,
  }));
  await setJsonCache(cacheKey, payload, 60);
  res.json(payload);
});

routesRouter.get("/me/favorites", async (req, res) => {
  const routes = await listFavoriteRoutes(req.auth!.userId);
  res.json(
    routes.map((route) => ({
      id: route.id,
      creatorId: route.creator_id,
      name: route.name,
      description: route.description,
      waypoints: route.waypoints,
      tags: route.tags,
      isPublic: route.is_public,
    })),
  );
});

routesRouter.get("/:id", async (req, res) => {
  const route = await getRouteById(req.params.id);
  if (!route) {
    res.status(404).json({ message: "Route not found" });
    return;
  }

  if (!route.is_public && route.creator_id !== req.auth!.userId) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  res.json({
    id: route.id,
    creatorId: route.creator_id,
    name: route.name,
    description: route.description,
    waypoints: route.waypoints,
    tags: route.tags,
    isPublic: route.is_public,
  });
});

routesRouter.post("/:id/favorite", async (req, res) => {
  const route = await getRouteById(req.params.id);
  if (!route) {
    res.status(404).json({ message: "Route not found" });
    return;
  }

  await favoriteRoute(req.auth!.userId, route.id);
  const favorites = await listFavoriteRoutes(req.auth!.userId);

  res.json({ favorites: favorites.map((f) => f.id) });
});
