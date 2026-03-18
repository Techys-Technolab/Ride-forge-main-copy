import { NextFunction, Request, Response } from "express";
import { findUserById } from "../modules/auth/repository";

export const adminGuard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.auth?.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const user = await findUserById(req.auth.userId);
  if (!user || user.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
};
