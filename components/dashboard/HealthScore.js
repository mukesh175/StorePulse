const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function colorFor(score) {
  if (score >= 85) return 'var(--sp-success)';
  if (score >= 65) return 'var(--sp-warning)';
  return 'var(--sp-critical)';
}

export default function HealthScore({ score, label, counts, delayedOrders = 0 }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="sp-card sp-card-pad h-100 d-flex flex-column flex-sm-row flex-lg-column align-items-center gap-3 text-center">
      <div className="sp-ring-wrap" role="img" aria-label={`Store health score ${clamped} out of 100 — ${label}`}>
        <svg width="148" height="148" viewBox="0 0 148 148">
          <circle className="sp-ring-track" cx="74" cy="74" r={RADIUS} fill="none" strokeWidth="11" />
          <circle
            className="sp-ring-bar"
            cx="74"
            cy="74"
            r={RADIUS}
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            stroke={colorFor(clamped)}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 74 74)"
          />
        </svg>
        <div className="sp-ring-value">
          <div className="sp-ring-number">{clamped}</div>
          <div className="sp-ring-caption">Store health</div>
        </div>
      </div>

      <div className="w-100">
        <div className="sp-pill neutral mb-2">{label}</div>
        <div className="d-flex justify-content-center gap-3 flex-wrap sp-card-sub">
          <span>🔴 {counts.CRITICAL} Critical</span>
          <span>🟠 {counts.WARNING} Warnings</span>
          <span>🟢 {counts.SUCCESS + counts.INFO} Positive</span>
        </div>
        {delayedOrders > 0 && (
          <div className="sp-card-sub mt-2">
            {delayedOrders} order{delayedOrders === 1 ? '' : 's'} awaiting fulfillment
          </div>
        )}
      </div>
    </div>
  );
}
