import { Router } from "express";
import { z } from "zod";
import { authGuard } from "../../middleware/auth";
import { sendPushToUsersSafe } from "../notifications/service";
import { applyRideDistanceRewards, getRideRewardProgress } from "../rewards/repository";
import { createRide, getRide, getRideHistorySummary, listRides, stopRide } from "./repository";

const pointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  speed: z.number().optional(),
  altitude: z.number().optional(),
  ts: z.string(),
});

const startRideSchema = z.object({
  points: z.array(pointSchema).default([]),
});

const stopRideSchema = z.object({
  points: z.array(pointSchema).min(1),
  distanceKm: z.number().optional(),
  durationSec: z.number().optional(),
  avgSpeedKmh: z.number().optional(),
  maxSpeedKmh: z.number().optional(),
});

export const ridesRouter = Router();
ridesRouter.use(authGuard);

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calculateRideStats(points: Array<{ lat: number; lng: number; ts: string; speed?: number }>): {
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
} {
  let distanceKm = 0;
  for (let i = 1; i < points.length; i += 1) {
    distanceKm += haversineKm(points[i - 1], points[i]);
  }

  const startTs = points[0] ? new Date(points[0].ts).getTime() : Date.now();
  const endTs = points[points.length - 1] ? new Date(points[points.length - 1].ts).getTime() : startTs;
  const durationSec = Math.max(Math.round((endTs - startTs) / 1000), 1);
  const avgSpeedKmh = durationSec > 0 ? (distanceKm / durationSec) * 3600 : 0;
  const maxSpeedKmh = points.reduce((max, point) => Math.max(max, Number(point.speed ?? 0) * 3.6), 0);

  return {
    distanceKm: Number(distanceKm.toFixed(3)),
    durationSec,
    avgSpeedKmh: Number(avgSpeedKmh.toFixed(2)),
    maxSpeedKmh: Number(maxSpeedKmh.toFixed(2)),
  };
}

ridesRouter.post("/start", async (req, res) => {
  const parsed = startRideSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const ride = await createRide({ userId: req.auth!.userId, points: parsed.data.points });
  res.status(201).json({
    id: ride.id,
    userId: ride.user_id,
    distanceKm: Number(ride.distance_km),
    durationSec: ride.duration_sec,
    avgSpeedKmh: Number(ride.avg_speed_kmh),
    maxSpeedKmh: Number(ride.max_speed_kmh),
    startedAt: ride.started_at,
    endedAt: ride.ended_at,
    points: ride.points,
  });
});

ridesRouter.post("/:id/stop", async (req, res) => {
  const parsed = stopRideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const computed = calculateRideStats(parsed.data.points);

  const ride = await stopRide({
    id: req.params.id,
    userId: req.auth!.userId,
    points: parsed.data.points,
    distanceKm: computed.distanceKm || parsed.data.distanceKm || 0,
    durationSec: computed.durationSec || parsed.data.durationSec || 1,
    avgSpeedKmh: computed.avgSpeedKmh || parsed.data.avgSpeedKmh || 0,
    maxSpeedKmh: computed.maxSpeedKmh || parsed.data.maxSpeedKmh || 0,
  });

  if (!ride) {
    res.status(404).json({ message: "Ride not found" });
    return;
  }

  const rewardUpdate = await applyRideDistanceRewards({
    userId: req.auth!.userId,
    distanceKm: Number(ride.distance_km),
    rideId: ride.id,
  });

  await sendPushToUsersSafe({
    userIds: [req.auth!.userId],
    title: "Ride saved",
    body:
      rewardUpdate.earnedPoints > 0
        ? `You completed ${Number(ride.distance_km).toFixed(1)} km and earned ${rewardUpdate.earnedPoints} point(s).`
        : `You completed ${Number(ride.distance_km).toFixed(1)} km. Keep riding to reach your next reward point.`,
    data: { type: "ride_complete", rideId: ride.id },
  });

  res.json({
    id: ride.id,
    userId: ride.user_id,
    distanceKm: Number(ride.distance_km),
    durationSec: ride.duration_sec,
    avgSpeedKmh: Number(ride.avg_speed_kmh),
    maxSpeedKmh: Number(ride.max_speed_kmh),
    startedAt: ride.started_at,
    endedAt: ride.ended_at,
    points: ride.points,
    rewardEarned: rewardUpdate.earnedPoints,
    newRewardBalance: rewardUpdate.balance,
    totalDistanceKm: rewardUpdate.totalDistanceKm,
    rewardRemainderKm: rewardUpdate.remainderKm,
  });
});

ridesRouter.get("/history/summary", async (req, res) => {
  const history = await getRideHistorySummary(req.auth!.userId);
  const reward = await getRideRewardProgress(req.auth!.userId);

  res.json({
    userId: req.auth!.userId,
    totalDistanceKm: Number(history.totalDistanceKm.toFixed(3)),
    totalDurationSec: history.totalDurationSec,
    rideCount: history.rideCount,
    rewardPoints: reward.rewardPoints,
    rewardRemainderKm: Number(reward.remainderKm.toFixed(3)),
    rewardRule: "1 point per 100 km",
  });
});

ridesRouter.get("/:id", async (req, res) => {
  const ride = await getRide(req.params.id, req.auth!.userId);
  if (!ride) {
    res.status(404).json({ message: "Ride not found" });
    return;
  }

  res.json({
    id: ride.id,
    userId: ride.user_id,
    distanceKm: Number(ride.distance_km),
    durationSec: ride.duration_sec,
    avgSpeedKmh: Number(ride.avg_speed_kmh),
    maxSpeedKmh: Number(ride.max_speed_kmh),
    startedAt: ride.started_at,
    endedAt: ride.ended_at,
    points: ride.points,
  });
});

ridesRouter.get("/", async (req, res) => {
  const rides = await listRides(req.auth!.userId);
  res.json(
    rides.map((ride) => ({
      id: ride.id,
      userId: ride.user_id,
      distanceKm: Number(ride.distance_km),
      durationSec: ride.duration_sec,
      avgSpeedKmh: Number(ride.avg_speed_kmh),
      maxSpeedKmh: Number(ride.max_speed_kmh),
      startedAt: ride.started_at,
      endedAt: ride.ended_at,
      points: ride.points,
    })),
  );
});
