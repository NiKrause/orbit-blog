type RelayDatabaseRow = {
  address?: string;
  lastSyncedAt?: string;
};

type RelayDatabaseListing = {
  probe: 'listed' | 'not_listed' | 'unknown';
  row: RelayDatabaseRow | null;
};

function splitCsv(raw: string): string[] {
  return [...new Set(raw.split(',').map((part) => part.trim()).filter(Boolean))];
}

function normalizeOrbitDbAddress(address: string): string {
  return address.trim().replace(/\/+$/, '');
}

function parseIsoToMs(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const ms = Date.parse(raw.trim());
  return Number.isNaN(ms) ? null : ms;
}

function pickNewerRow(current: RelayDatabaseRow | null, candidate: RelayDatabaseRow | null): RelayDatabaseRow | null {
  if (!candidate) return current;
  if (!current) return candidate;

  const currentMs = parseIsoToMs(current.lastSyncedAt);
  const candidateMs = parseIsoToMs(candidate.lastSyncedAt);

  if (candidateMs === null) return current;
  if (currentMs === null) return candidate;
  return candidateMs > currentMs ? candidate : current;
}

export function getRelayMetricsOrigins(metricsOriginsRaw: string): string[] {
  return splitCsv(metricsOriginsRaw).map((origin) => origin.replace(/\/$/, ''));
}

export async function requestRelayDatabaseSync(metricsOrigin: string, dbAddressRaw: string): Promise<boolean> {
  const dbAddress = normalizeOrbitDbAddress(dbAddressRaw);
  if (!metricsOrigin || !dbAddress) return false;

  try {
    const response = await fetch(`${metricsOrigin}/pinning/sync`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbAddress }),
    });
    if (!response.ok) return false;

    const json = (await response.json()) as { ok?: boolean };
    return json.ok === true;
  } catch {
    return false;
  }
}

export async function requestRelayDatabaseSyncAny(
  metricsOrigins: string[],
  dbAddress: string,
): Promise<boolean> {
  let anyOk = false;
  for (const origin of metricsOrigins) {
    if (await requestRelayDatabaseSync(origin, dbAddress)) {
      anyOk = true;
    }
  }
  return anyOk;
}

export async function fetchRelayDatabaseListing(
  metricsOrigin: string,
  dbAddressRaw: string,
): Promise<RelayDatabaseListing> {
  const dbAddress = normalizeOrbitDbAddress(dbAddressRaw);
  if (!metricsOrigin || !dbAddress) return { probe: 'unknown', row: null };

  const url = new URL('/pinning/databases', metricsOrigin);
  url.searchParams.set('address', dbAddress);

  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (response.status === 404) return { probe: 'not_listed', row: null };
    if (!response.ok) return { probe: 'unknown', row: null };

    const json = (await response.json()) as { databases?: RelayDatabaseRow[] };
    const databases = Array.isArray(json.databases) ? json.databases : [];
    const row =
      databases.find((candidate) => normalizeOrbitDbAddress(candidate.address ?? '') === dbAddress) ?? null;

    return row ? { probe: 'listed', row } : { probe: 'not_listed', row: null };
  } catch {
    return { probe: 'unknown', row: null };
  }
}

export async function fetchRelayDatabaseListingAny(
  metricsOrigins: string[],
  dbAddress: string,
): Promise<RelayDatabaseListing> {
  const results = await Promise.all(metricsOrigins.map((origin) => fetchRelayDatabaseListing(origin, dbAddress)));

  let newestRow: RelayDatabaseRow | null = null;
  for (const result of results) {
    if (result.probe === 'listed') {
      newestRow = pickNewerRow(newestRow, result.row);
    }
  }

  if (newestRow) return { probe: 'listed', row: newestRow };
  if (results.some((result) => result.probe === 'not_listed')) return { probe: 'not_listed', row: null };
  return { probe: 'unknown', row: null };
}
