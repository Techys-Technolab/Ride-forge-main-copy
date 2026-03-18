import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface JwtPayload {
  sub: string;
  email: string;
}

export const signAccessToken = (userId: string, email: string): string =>
  jwt.sign({ sub: userId, email }, env.jwtSecret, { expiresIn: "2h" });

export const signRefreshToken = (userId: string, email: string): string =>
  jwt.sign({ sub: userId, email }, env.jwtSecret, { expiresIn: "30d" });

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
};
