/**
 * Masked API key display (UX §7.2). Never log the plaintext argument.
 */
export function maskApiKeyLast4(plain: string): string {
  const t = typeof plain === 'string' ? plain : '';
  if (t.length === 0) return '';
  if (t.length <= 4) return `••••••${t}`;
  return `••••••${t.slice(-4)}`;
}
