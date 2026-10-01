export function validateApiKey(
  authHeader?: string,
  apiKeyHeader?: string,
  queryKey?: string,
  configuredKey?: string
): boolean {
  if (!configuredKey) return true;

  if (apiKeyHeader && apiKeyHeader === configuredKey) return true;

  if (authHeader) {
    const parts = authHeader.split(" ");
    const token = parts.length === 2 ? parts[1] : parts[0];
    if (token === configuredKey) return true;
  }

  if (queryKey && queryKey === configuredKey) return true;

  return false;
}
