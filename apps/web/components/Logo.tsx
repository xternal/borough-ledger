/** The Borough Book mark, inline so the top bar needs no extra request. Same drawing as app/icon.svg (lib/logo.ts). */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bb-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d6dff" />
          <stop offset="1" stopColor="#1b40c9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#bb-mark-bg)" />
      <path d="M32 21C25 16.4 15 15.6 6.5 17.6V50.5C15 48.8 25 49.6 32 53.6C39 49.6 49 48.8 57.5 50.5V17.6C49 15.6 39 16.4 32 21Z" fill="#9fb4ff" />
      <path d="M32 19.5C25 15 15 14.2 6.5 16.2V48C15 46.3 25 47.1 32 51.2Z" fill="#dfe7ff" />
      <path d="M32 19.5C39 15 49 14.2 57.5 16.2V48C49 46.3 39 47.1 32 51.2Z" fill="#ffffff" />
      <rect x="36" y="35" width="5.4" height="9" rx="1.3" fill="#2457f5" />
      <rect x="43" y="29.5" width="5.4" height="14.5" rx="1.3" fill="#2457f5" />
      <rect x="50" y="23.5" width="5.4" height="20.5" rx="1.3" fill="#2457f5" />
      <path d="M20 9H27V33.5L23.5 30L20 33.5Z" fill="#f2600c" />
    </svg>
  );
}
