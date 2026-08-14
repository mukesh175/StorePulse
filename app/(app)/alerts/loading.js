import { AlertCardSkeleton, SkeletonLine } from '@/components/ui/Skeletons';

export default function Loading() {
  return (
    <div>
      <SkeletonLine width={220} height={24} />
      <div className="mt-2 mb-4">
        <SkeletonLine width={320} height={12} />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <AlertCardSkeleton key={i} />
      ))}
    </div>
  );
}
