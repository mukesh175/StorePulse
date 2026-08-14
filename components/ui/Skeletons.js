export function SkeletonLine({ width = '100%', height = 12, className = '' }) {
  return <div className={`sp-skeleton ${className}`} style={{ width, height }} />;
}

export function MetricCardSkeleton() {
  return (
    <div className="sp-card sp-card-pad h-100">
      <SkeletonLine width="45%" height={10} />
      <div className="mt-3">
        <SkeletonLine width="65%" height={24} />
      </div>
      <div className="mt-3">
        <SkeletonLine width="35%" height={10} />
      </div>
    </div>
  );
}

export function AlertCardSkeleton() {
  return (
    <div className="sp-card sp-card-pad mb-2">
      <SkeletonLine width={78} height={14} />
      <div className="mt-3">
        <SkeletonLine width="52%" height={16} />
      </div>
      <div className="mt-2">
        <SkeletonLine width="82%" height={12} />
      </div>
      <div className="mt-2">
        <SkeletonLine width="34%" height={12} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="sp-card sp-card-pad">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="d-flex gap-3 align-items-center py-2">
          <SkeletonLine width={38} height={38} />
          <SkeletonLine width="30%" height={12} />
          <SkeletonLine width="18%" height={12} />
          <SkeletonLine width="14%" height={12} />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <SkeletonLine width={280} height={26} />
      <div className="mt-2">
        <SkeletonLine width={380} height={13} />
      </div>
      <div className="row g-3 mt-3">
        <div className="col-12 col-lg-4">
          <div className="sp-card sp-card-pad" style={{ height: 210 }} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="col-6 col-lg-2" key={i}>
            <MetricCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
