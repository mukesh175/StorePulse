import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="sp-card sp-empty" style={{ maxWidth: 460 }}>
        <div className="sp-empty-emoji" aria-hidden="true">
          🔍
        </div>
        <div className="sp-empty-title">Page not found</div>
        <p className="sp-empty-text">The page you were looking for does not exist or has been moved.</p>
        <Link href="/dashboard" className="sp-btn sp-btn-primary mt-3">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
