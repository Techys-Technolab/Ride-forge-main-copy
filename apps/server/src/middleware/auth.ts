import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/token";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
      };
    }
  }
}

export const authGuard = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  try {
    const token = header.replace("Bearer ", "");
    const payload = verifyToken(token);
    req.auth = { userId: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
