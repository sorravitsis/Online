export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  secret?: string
) {
  if (!secret) {
    return true;
  }

  return authorizationHeader === `Bearer ${secret}`;
}
