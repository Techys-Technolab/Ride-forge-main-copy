import fs from "fs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type PushPayload = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
};

type PushResponse = {
  sent: number;
  failed: number;
  invalidTokens: string[];
};

let firebaseReady = false;
let serviceAccount: FirebaseServiceAccount | null = null;
let accessTokenCache: { token: string; expiresAt: number } | null = null;

function readServiceAccountFromPath(pathValue: string): FirebaseServiceAccount | null {
  if (!pathValue || !fs.existsSync(pathValue)) return null;
  const raw = fs.readFileSync(pathValue, "utf8");
  return JSON.parse(raw) as FirebaseServiceAccount;
}

function resolveServiceAccount(): FirebaseServiceAccount | null {
  if (serviceAccount) return serviceAccount;

  if (env.firebaseServiceAccountJson) {
    serviceAccount = JSON.parse(env.firebaseServiceAccountJson) as FirebaseServiceAccount;
    return serviceAccount;
  }

  if (env.firebaseServiceAccountPath) {
    serviceAccount = readServiceAccountFromPath(env.firebaseServiceAccountPath);
    if (serviceAccount) return serviceAccount;
  }

  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    serviceAccount = {
      project_id: env.firebaseProjectId,
      client_email: env.firebaseClientEmail,
      private_key: env.firebasePrivateKey.replace(/\\n/g, "\n"),
    };
    return serviceAccount;
  }

  return null;
}

export function initFirebasePush(): void {
  const account = resolveServiceAccount();
  if (!account) {
    console.warn("Firebase push not configured. Push notifications will be skipped.");
    firebaseReady = false;
    return;
  }

  firebaseReady = true;
  console.log(`Firebase push configured for project ${account.project_id}`);
}

export function isFirebaseReady(): boolean {
  return firebaseReady && !!resolveServiceAccount();
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAt - 60_000 > now) {
    return accessTokenCache.token;
  }

  const account = resolveServiceAccount();
  if (!account) {
    throw new Error("Firebase service account is not configured");
  }

  const assertion = jwt.sign(
    {
      iss: account.client_email,
      sub: account.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    },
    account.private_key,
    {
      algorithm: "RS256",
      expiresIn: "1h",
    },
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase access token: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  accessTokenCache = {
    token: payload.access_token,
    expiresAt: now + payload.expires_in * 1000,
  };
  return payload.access_token;
}

function isInvalidTokenResponse(text: string): boolean {
  const normalized = text.toUpperCase();
  return normalized.includes("UNREGISTERED") || normalized.includes("INVALID_ARGUMENT") || normalized.includes("REGISTRATION_TOKEN_NOT_REGISTERED");
}

export async function sendFirebasePush(input: PushPayload): Promise<PushResponse> {
  if (!isFirebaseReady()) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  const account = resolveServiceAccount();
  if (!account) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  const tokens = Array.from(new Set(input.tokens.filter(Boolean)));
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  const accessToken = await getAccessToken();
  const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: input.title,
              body: input.body,
            },
            data: input.data,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${token}::${response.status}::${text}`);
      }

      return token;
    }),
  );

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sent += 1;
      return;
    }

    failed += 1;
    const token = tokens[index];
    const errorText = String(result.reason ?? "");
    if (isInvalidTokenResponse(errorText)) {
      invalidTokens.push(token);
    }
  });

  return { sent, failed, invalidTokens };
}
