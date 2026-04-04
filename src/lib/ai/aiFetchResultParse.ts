/**
 * Parse provider getResult JSON for optional inline text (FR-8c / Story 5.2 Task 5).
 * Does not log payloads (NFR-1).
 */

function looksLikeHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function pushString(out: string[], v: unknown): void {
  if (typeof v === 'string') {
    const t = v.trim();
    if (t) out.push(t);
  }
}

/**
 * Best-effort extraction of human-readable text to merge into the post body.
 * Skips values that duplicate `assetUrl` or look like standalone asset URLs.
 */
export function extractOutputText(
  json: Record<string, unknown>,
  assetUrl?: string,
): string | undefined {
  const candidates: string[] = [];
  pushString(candidates, json.text);
  pushString(candidates, json.caption);
  pushString(candidates, json.message);
  pushString(candidates, json.description);

  const data = json.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    pushString(candidates, d.text);
    pushString(candidates, d.caption);
    pushString(candidates, d.message);
  }

  const rawOut = json.output;
  if (typeof rawOut === 'string') {
    pushString(candidates, rawOut);
  } else if (rawOut && typeof rawOut === 'object') {
    const o = rawOut as Record<string, unknown>;
    pushString(candidates, o.text);
    pushString(candidates, o.caption);
    pushString(candidates, o.message);
  }

  const normAsset = assetUrl?.trim() ?? '';
  for (const c of candidates) {
    if (normAsset && c === normAsset) continue;
    if (looksLikeHttpUrl(c)) continue;
    return c;
  }
  return undefined;
}
