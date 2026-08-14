'use client';

export default function GlobalError({ reset }) {
  // Technical detail stays in the server logs — merchants see a plain message.
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="sp-card sp-empty" style={{ maxWidth: 460 }}>
        <div className="sp-empty-emoji" aria-hidden="true">
          ⚠️
        </div>
        <div className="sp-empty-title">Something went wrong</div>
        <p className="sp-empty-text">
          We couldn&apos;t load this page. Your data is safe — this is usually temporary.
        </p>
        <button className="sp-btn sp-btn-primary mt-3" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
