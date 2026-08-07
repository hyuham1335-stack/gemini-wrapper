export function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
