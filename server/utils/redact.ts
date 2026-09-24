// Strip secrets from URLs before they are logged.
//  - /api/auth/password-reset/<token>  -> /api/auth/password-reset/[REDACTED]
//  - ?token=...                         -> ?token=[REDACTED]
export function redactUrl(url: string | undefined): string {
  if (!url) return "";
  return url
    .replace(/(\/password-reset\/)[^/?#]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:token|code|password)=)[^&#]*/gi, "$1[REDACTED]");
}
