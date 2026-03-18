import { db } from "../../db/pg";

interface RouteRow {
  id: string;
  creator_id: string;
  name: string;
  description?: string;
  waypoints: unknown;
  tags: string[];
  is_public: boolean;
}

export async function createRoute(input: {
  creatorId: string;
  name: string;
  description?: string;
  waypoints: unknown[];
  tags: string[];
  isPublic: boolean;
}): Promise<RouteRow> {
  const result = await db.query<RouteRow>(
    `INSERT INTO routes (creator_id, name, description, waypoints, tags, is_public)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     RETURNING id, creator_id, name, description, waypoints, tags, is_public`,
    [input.creatorId, input.name, input.description ?? null, JSON.stringify(input.waypoints), input.tags, input.isPublic],
  );
  return result.rows[0];
}

export async function listRoutes(userId: string): Promise<RouteRow[]> {
  const result = await db.query<RouteRow>(
    `SELECT id, creator_id, name, description, waypoints, tags, is_public
       FROM routes WHERE is_public = true OR creator_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getRouteById(id: string): Promise<RouteRow | null> {
  const result = await db.query<RouteRow>(
    `SELECT id, creator_id, name, description, waypoints, tags, is_public FROM routes WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function favoriteRoute(userId: string, routeId: string): Promise<void> {
  await db.query(
    `INSERT INTO route_favorites (user_id, route_id) VALUES ($1, $2) ON CONFLICT (user_id, route_id) DO NOTHING`,
    [userId, routeId],
  );
}

export async function listFavoriteRoutes(userId: string): Promise<RouteRow[]> {
  const result = await db.query<RouteRow>(
    `SELECT r.id, r.creator_id, r.name, r.description, r.waypoints, r.tags, r.is_public
       FROM routes r
       INNER JOIN route_favorites rf ON rf.route_id = r.id
      WHERE rf.user_id = $1`,
    [userId],
  );
  return result.rows;
}
