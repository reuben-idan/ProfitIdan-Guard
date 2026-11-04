const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#083f2e"/><text x="32" y="44" font-family="system-ui,sans-serif" font-size="36" font-weight="bold" fill="#fff" text-anchor="middle">P</text></svg>';

export function GET(): Response {
  return new Response(ICON, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
