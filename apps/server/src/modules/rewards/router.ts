import { Router } from "express";
import { authGuard } from "../../middleware/auth";
import { getRewardBalance, listRewardTransactions } from "./repository";

export const rewardsRouter = Router();
rewardsRouter.use(authGuard);

rewardsRouter.get("/balance", async (req, res) => {
  const points = await getRewardBalance(req.auth!.userId);
  res.json({ userId: req.auth!.userId, points });
});

rewardsRouter.get("/transactions", async (req, res) => {
  const rows = await listRewardTransactions(req.auth!.userId);
  res.json(
    rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      pointsDelta: Number(row.points_delta),
      reason: row.reason,
      metadata: row.metadata,
      createdAt: row.created_at,
    })),
  );
});
