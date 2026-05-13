/** Loading placeholders shown while store-scoped data is fetching */

const pulse = 'animate-pulse bg-slate-700/45 rounded-lg';

export function SkBlock({ className = '' }) {
  return <div className={`${pulse} ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkBlock className="h-14 w-full max-w-md" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-4 space-y-3">
            <SkBlock className="h-3 w-24" />
            <SkBlock className="h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <SkBlock className="h-5 w-48" />
          <SkBlock className="h-[200px] w-full" />
        </div>
        <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <SkBlock className="h-5 w-40" />
          <SkBlock className="h-[200px] w-full rounded-full max-w-[180px] mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function StatsRowSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl px-4 py-3 space-y-2">
          <SkBlock className="h-3 w-20" />
          <SkBlock className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function OrdersTableSkeleton({ rows = 8 }) {
  return (
    <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50 space-y-2">
        <SkBlock className="h-3 w-full max-w-xl" />
      </div>
      <div className="divide-y divide-slate-700/30">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-3 items-center">
            <SkBlock className="h-4 w-12 shrink-0" />
            <SkBlock className="h-4 w-20 shrink-0" />
            <SkBlock className="h-4 w-16 shrink-0" />
            <SkBlock className="h-4 flex-1" />
            <SkBlock className="h-4 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function KanbanSkeleton({ columns = 5 }) {
  return (
    <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-3 min-h-0 overflow-hidden">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="flex flex-col min-h-0 space-y-2">
          <SkBlock className="h-8 w-full" />
          <div className="space-y-2 flex-1 overflow-hidden">
            {[1, 2, 3].map((r) => (
              <div key={r} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-3 space-y-2">
                <SkBlock className="h-4 w-[85%]" />
                <SkBlock className="h-3 w-full" />
                <SkBlock className="h-3 w-[65%]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function KitchenBoardSkeleton() {
  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5].map((c) => (
        <div key={c} className="flex flex-col min-h-0 space-y-3">
          <SkBlock className="h-10 w-full" />
          <div className="space-y-3 flex-1">
            {[1, 2].map((r) => (
              <div key={r} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 space-y-3">
                <SkBlock className="h-5 w-2/3" />
                <SkBlock className="h-3 w-full" />
                <SkBlock className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MenuGridSkeleton({ cards = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700/50 overflow-hidden">
          <SkBlock className="h-32 w-full rounded-none" />
          <div className="p-3 space-y-2">
            <SkBlock className="h-4 w-[80%]" />
            <SkBlock className="h-4 w-[35%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DayEndReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 space-y-2">
            <SkBlock className="h-3 w-24" />
            <SkBlock className="h-8 w-20" />
          </div>
        ))}
      </div>
      <SkBlock className="h-64 w-full" />
    </div>
  );
}

export function SettingsChargesSkeleton() {
  return (
    <div className="space-y-4">
      <SkBlock className="h-10 w-full max-w-xs ml-auto" />
      <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl overflow-hidden space-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-4 border-b border-slate-700/30 flex gap-4">
            <SkBlock className="h-5 flex-1" />
            <SkBlock className="h-5 w-12" />
            <SkBlock className="h-5 w-16" />
            <SkBlock className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StaffListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
          <SkBlock className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkBlock className="h-4 w-40" />
            <SkBlock className="h-3 w-56" />
          </div>
          <SkBlock className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function PromoListSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
          <SkBlock className="h-12 w-12 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <SkBlock className="h-4 w-48" />
            <SkBlock className="h-3 w-full max-w-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SupplierCardsSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-5 space-y-4">
          <SkBlock className="h-6 w-2/3" />
          <SkBlock className="h-3 w-full" />
          <SkBlock className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function InventoryTableSkeleton({ rows = 8 }) {
  return (
    <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <SkBlock className="h-3 w-full max-w-lg" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-slate-700/30 flex gap-4">
          <SkBlock className="h-4 flex-1" />
          <SkBlock className="h-4 w-16" />
          <SkBlock className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
