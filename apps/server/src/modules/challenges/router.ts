import { Router } from "express";
import { authGuard } from "../../middleware/auth";
import { sendPushToUsersSafe } from "../notifications/service";
import { addRewardPoints, getRewardBalance } from "../rewards/repository";
import {
  completeChallenge,
  ensureDynamicChallenges,
  getChallengeById,
  isChallengeCompleted,
  listActiveChallenges,
} from "./repository";
import { findUserById } from "../auth/repository";

export const challengesRouter = Router();
challengesRouter.use(authGuard);

challengesRouter.get("/", async (req, res) => {
  const user = await findUserById(req.auth!.userId);
  await ensureDynamicChallenges(user?.city, user?.state);
  const challenges = await listActiveChallenges(user?.city, user?.state);
  const balance = await getRewardBalance(req.auth!.userId);

  res.json({
    rewardBalance: balance,
    challenges: challenges.map((challenge) => ({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      city: challenge.city,
      state: challenge.state,
      rewardPoints: Number(challenge.reward_points),
      startsAt: challenge.starts_at,
      endsAt: challenge.ends_at,
      dynamicSignal: challenge.dynamic_signal,
    })),
  });
});

challengesRouter.post("/:id/complete", async (req, res) => {
  const challenge = await getChallengeById(req.params.id);
  if (!challenge) {
    res.status(404).json({ message: "Challenge not found" });
    return;
  }

  const alreadyDone = await isChallengeCompleted(req.auth!.userId, challenge.id);
  if (alreadyDone) {
    res.status(409).json({ message: "Challenge already completed" });
    return;
  }

  await completeChallenge({ userId: req.auth!.userId, challengeId: challenge.id });
  const newBalance = await addRewardPoints({
    userId: req.auth!.userId,
    points: Number(challenge.reward_points),
    reason: "challenge_completion",
    metadata: { challengeId: challenge.id, title: challenge.title },
  });

  await sendPushToUsersSafe({
    userIds: [req.auth!.userId],
    title: "Challenge completed",
    body: `You earned ${Number(challenge.reward_points)} points from ${challenge.title}.`,
    data: { type: "challenge_complete", challengeId: challenge.id },
  });

  res.json({
    message: "Challenge completed",
    rewardEarned: Number(challenge.reward_points),
    newBalance,
  });
});
