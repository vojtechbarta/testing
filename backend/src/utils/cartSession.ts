const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireCartSessionIdHeader(raw: string | undefined): string {
  const v = raw?.trim();
  if (!v || !UUID_RE.test(v)) {
    throw new Error("Valid X-Cart-Session header (UUID) is required");
  }
  return v;
}
