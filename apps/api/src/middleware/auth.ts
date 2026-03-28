import { createClerkClient } from '@clerk/fastify';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? '';
const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? '';

const clerkClient = createClerkClient({
  secretKey: CLERK_SECRET_KEY,
  publishableKey: CLERK_PUBLISHABLE_KEY,
});

export interface AuthResult {
  readonly userId: string | null;
  readonly sessionId: string | null;
}

export async function verifyClerkToken(authHeader: string | undefined): Promise<AuthResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null, sessionId: null };
  }

  const token = authHeader.slice(7);

  if (!token || token.length === 0) {
    return { userId: null, sessionId: null };
  }

  try {
    const verifiedToken = await clerkClient.verifyToken(token);
    return {
      userId: verifiedToken.sub ?? null,
      sessionId: verifiedToken.sid ?? null,
    };
  } catch (err) {
    console.warn('[Auth] Token verification failed:', err instanceof Error ? err.message : 'Unknown error');
    return { userId: null, sessionId: null };
  }
}

export { clerkClient };
