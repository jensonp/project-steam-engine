const STEAM_APP_ID_IN_HEADER_IMAGE_REGEX = /\/apps\/(\d+)\//i;

export function extractCanonicalAppIdFromHeaderImage(
  headerImage: string | null | undefined
): number | null {
  if (!headerImage) return null;
  const match = STEAM_APP_ID_IN_HEADER_IMAGE_REGEX.exec(headerImage);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function canonicalizeAppId(
  appId: number,
  headerImage: string | null | undefined
): number {
  const canonical = extractCanonicalAppIdFromHeaderImage(headerImage);
  return canonical ?? appId;
}
