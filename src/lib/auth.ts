import { SignJWT, jwtVerify, JWTPayload } from "jose";

function getJWTSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured in environment variables");
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

function getRefreshSecret() {
  if (!process.env.REFRESH_SECRET) {
    throw new Error("REFRESH_SECRET is not configured in environment variables");
  }
  return new TextEncoder().encode(process.env.REFRESH_SECRET);
}

export interface TokenPayload {
  userId: string;
  email: string;
}

// Extend JWTPayload to include our custom claims
interface CustomJWTPayload extends JWTPayload {
  userId: string;
  email: string;
}

// Generate short-lived access token (15 minutes)
export async function generateAccessToken(
  payload: TokenPayload
): Promise<string> {
  const secret = getJWTSecret();
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

// Generate long-lived refresh token (7 days)
export async function generateRefreshToken(
  payload: TokenPayload
): Promise<string> {
  const secret = getRefreshSecret();
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

// Verify access token
export async function verifyAccessToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const secret = getJWTSecret();
    const verified = await jwtVerify<CustomJWTPayload>(token, secret);
    return {
      userId: verified.payload.userId,
      email: verified.payload.email,
    };
  } catch (error: any) {
    console.error("Token verification failed:", error.message);
    return null;
  }
}

// Verify refresh token
export async function verifyRefreshToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const secret = getRefreshSecret();
    const verified = await jwtVerify<CustomJWTPayload>(token, secret);
    return {
      userId: verified.payload.userId,
      email: verified.payload.email,
    };
  } catch (error: any) {
    console.error("Refresh token verification failed:", error.message);
    return null;
  }
}
