export function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * Every protected route rejects an unauthenticated caller the same way, so the
 * message and status live here instead of being retyped in each handler.
 */
export function unauthorizedResponse() {
  return errorResponse("로그인이 필요합니다.", 401);
}

/**
 * Reads a JSON request body, returning `null` instead of throwing when the body
 * is absent or malformed so handlers can answer 400 without a try/catch each.
 */
export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
