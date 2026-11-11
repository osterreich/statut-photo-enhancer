import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import {
  JOB_OWNER_TYPES,
  type JobOwner,
} from "@/lib/job-types";

export const PHOTO_SESSION_COOKIE = "photo_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function createSessionId(): string {
  return randomBytes(32).toString("base64url");
}

function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

export async function getSessionOwner(): Promise<JobOwner> {
  const cookieStore = await cookies();
  const currentSessionId = cookieStore.get(PHOTO_SESSION_COOKIE)?.value;
  const sessionId =
    currentSessionId && SESSION_ID_PATTERN.test(currentSessionId)
      ? currentSessionId
      : createSessionId();

  if (sessionId !== currentSessionId) {
    cookieStore.set({
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
      name: PHOTO_SESSION_COOKIE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      value: sessionId,
    });
  }

  return {
    ownerId: hashSessionId(sessionId),
    ownerType: JOB_OWNER_TYPES.SESSION,
  };
}
