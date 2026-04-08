export async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().includes("application/json")) {
    return (await response.json()) as T;
  }

  const bodyText = await response.text();
  const trimmed = bodyText.trim();

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error(
      `The server returned HTML instead of JSON (status ${response.status}). Sign in again and retry.`
    );
  }

  throw new Error(trimmed || `Unexpected API response with status ${response.status}.`);
}
