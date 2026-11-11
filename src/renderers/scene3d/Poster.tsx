import './scene3d.css';

export interface PosterProps {
  /** Why the scene is not running, in plain words. */
  reason?: string;
}

/**
 * The poster scene.
 *
 * "Show a poster image first so the largest paint lands before the 3D loads."
 * This is that image, drawn in SVG so it costs nothing: the sky at the
 * current stage, the horizon, the two rails, and the front of the train.
 *
 * It is also what a visitor without WebGL gets instead of the scene, so it
 * has to look like a deliberate frame rather than a fallback.
 */
export function Poster({ reason }: PosterProps) {
  return (
    <div className="poster" role="img" aria-label="A train on the line, seen from the platform">
      <svg
        className="poster__art"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="poster-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0a33" />
            <stop offset="55%" stopColor="#4a2a4a" />
            <stop offset="100%" stopColor="#b0472f" />
          </linearGradient>
          <linearGradient id="poster-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c0c26" />
            <stop offset="100%" stopColor="#000016" />
          </linearGradient>
        </defs>

        <rect width="1200" height="700" fill="url(#poster-sky)" />
        <rect y="470" width="1200" height="230" fill="url(#poster-ground)" />

        {/* The city, flat blocks in the fog. */}
        <g fill="#9797a5" opacity="0.28">
          <rect x="40" y="330" width="90" height="140" />
          <rect x="150" y="290" width="64" height="180" />
          <rect x="240" y="360" width="120" height="110" />
          <rect x="380" y="310" width="70" height="160" />
          <rect x="470" y="380" width="140" height="90" />
          <rect x="640" y="300" width="80" height="170" />
          <rect x="740" y="350" width="110" height="120" />
          <rect x="880" y="320" width="66" height="150" />
          <rect x="970" y="370" width="130" height="100" />
          <rect x="1120" y="310" width="70" height="160" />
        </g>

        {/* The platform edge and the rails. */}
        <rect x="0" y="470" width="1200" height="6" fill="#e4032e" />
        <rect x="0" y="540" width="1200" height="10" fill="#f1f1f1" opacity="0.75" />
        <rect x="0" y="600" width="1200" height="10" fill="#f1f1f1" opacity="0.55" />

        {/* The train, seen head on. */}
        <g transform="translate(600 400)">
          <rect x="-96" y="-120" width="192" height="240" fill="#000016" />
          <rect x="-96" y="-120" width="192" height="240" fill="none" stroke="#f1f1f1" strokeWidth="4" />
          <rect x="-70" y="-92" width="140" height="62" fill="#e4032e" />
          <rect x="-56" y="10" width="46" height="14" fill="#9797a5" />
          <rect x="10" y="10" width="46" height="14" fill="#9797a5" />
          <circle cx="-56" cy="86" r="12" fill="#e4032e" />
          <circle cx="56" cy="86" r="12" fill="#e4032e" />
        </g>
      </svg>

      <p className="poster__caption mono">The Local 3D</p>
      {reason ? <p className="poster__reason mono">{reason}</p> : null}
    </div>
  );
}
