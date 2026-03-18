import { db } from "../../db/pg";

interface EventRow {
  id: string;
  host_id: string;
  kind: "ride" | "event";
  title: string;
  description?: string;
  start_at: string;
  location_name: string;
  lat: number;
  lng: number;
}

export async function createEvent(input: {
  hostId: string;
  kind: "ride" | "event";
  title: string;
  description?: string;
  startAt: string;
  locationName: string;
  lat: number;
  lng: number;
}): Promise<EventRow> {
  const eventResult = await db.query<EventRow>(
    `INSERT INTO events (host_id, kind, title, description, start_at, location_name, lat, lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, host_id, kind, title, description, start_at, location_name, lat, lng`,
    [input.hostId, input.kind, input.title, input.description ?? null, input.startAt, input.locationName, input.lat, input.lng],
  );

  await db.query(`INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    eventResult.rows[0].id,
    input.hostId,
  ]);
  return eventResult.rows[0];
}

export async function listEvents(): Promise<Array<EventRow & { attendee_ids: string[] }>> {
  const result = await db.query<EventRow & { attendee_ids: string[] }>(
    `SELECT e.id, e.host_id, e.kind, e.title, e.description, e.start_at, e.location_name, e.lat, e.lng,
            COALESCE(array_agg(ea.user_id) FILTER (WHERE ea.user_id IS NOT NULL), '{}') AS attendee_ids
       FROM events e
       LEFT JOIN event_attendees ea ON ea.event_id = e.id
      GROUP BY e.id
      ORDER BY e.start_at ASC`,
  );
  return result.rows;
}

export async function rsvpEvent(eventId: string, userId: string): Promise<void> {
  await db.query(`INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [eventId, userId]);
}

export async function findEventById(eventId: string): Promise<EventRow | null> {
  const result = await db.query<EventRow>(
    `SELECT id, host_id, kind, title, description, start_at, location_name, lat, lng
       FROM events
      WHERE id = $1
      LIMIT 1`,
    [eventId],
  );
  return result.rows[0] ?? null;
}

export async function isEventAttendee(eventId: string, userId: string): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
         FROM event_attendees
        WHERE event_id = $1 AND user_id = $2
     ) AS exists`,
    [eventId, userId],
  );
  return Boolean(result.rows[0]?.exists);
}
