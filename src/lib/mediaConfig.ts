export const DEFAULT_MEDIA_MAX_FILE_SIZE_MB = 100;

export function parseMediaMaxFileSizeMb(
  rawValue: unknown,
  fallbackMb = DEFAULT_MEDIA_MAX_FILE_SIZE_MB,
): number {
  const parsed =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number.parseFloat(rawValue.trim())
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMb;
  }

  return parsed;
}

export function formatMediaMaxFileSizeMb(megabytes: number): string {
  const normalized = Number.isInteger(megabytes)
    ? String(megabytes)
    : megabytes.toFixed(2).replace(/\.?0+$/, '');

  return `${normalized} MB`;
}

const rawConfiguredMegabytes = (
  import.meta as ImportMeta & { env?: Record<string, unknown> }
).env?.VITE_MEDIA_MAX_FILE_SIZE_MB;

export const MEDIA_MAX_FILE_SIZE_MB = parseMediaMaxFileSizeMb(
  rawConfiguredMegabytes,
);

export const MEDIA_MAX_FILE_SIZE_BYTES = Math.floor(
  MEDIA_MAX_FILE_SIZE_MB * 1024 * 1024,
);

export const MEDIA_MAX_FILE_SIZE_LABEL = formatMediaMaxFileSizeMb(
  MEDIA_MAX_FILE_SIZE_MB,
);

export function isMediaFileTooLarge(sizeInBytes: number): boolean {
  return sizeInBytes > MEDIA_MAX_FILE_SIZE_BYTES;
}
