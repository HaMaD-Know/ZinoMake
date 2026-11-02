export function LogoMark({ size = 34 }: { size?: number }) {
  // Original mark: three stacked "blocks" forming a Z, with a play notch.
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="4" y="5" width="26" height="9" rx="3" fill="#5b4bdb" />
      <rect x="13" y="15.5" width="14" height="9" rx="3" fill="#f59f00" transform="rotate(-12 20 20)" />
      <rect x="10" y="26" width="26" height="9" rx="3" fill="#1f9d55" />
      <path d="M31 6.5 L37 9.5 L31 12.5 Z" fill="#5b4bdb" />
    </svg>
  );
}

export function Logo({ href = '#/' }: { href?: string }) {
  return (
    <a className="logo" href={href} aria-label="ZinoMake home">
      <LogoMark />
      <span>
        Zino<b>Make</b>
      </span>
    </a>
  );
}
