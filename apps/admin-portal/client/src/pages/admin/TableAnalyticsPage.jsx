import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Clock, DollarSign, Users, TrendingUp, TrendingDown,
  Calendar, ChevronLeft, ChevronRight, Table, Utensils, RefreshCw,
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import FilterPanel from '../../components/FilterPanel';

function KPICard({ icon: Icon, label, value, unit, trend, trendLabel, color = 'amber' }) {
  const colorClasses = {
    amber: 'text-amber-400 bg-amber-500/20',
    teal: 'text-teal-400 bg-teal-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
    blue: 'text-blue-400 bg-blue-500/20',
    green: 'text-green-400 bg-green-500/20',
  };
  const iconClass = colorClasses[color] || colorClasses.amber;

  return (
    <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconClass}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-[var(--pos-text-primary)] mt-3">
        {value}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
      {trendLabel && <p className="text-xs text-slate-500 mt-0.5">{trendLabel}</p>}
    </div>
  );
}

function HourlyHeatmap({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500">
        No hourly data available
      </div>
    );
  }

  // Aggregate by hour (data comes as 7 days x 24 hours, we want just 24 hours)
  const hourlyAgg = {};
  for (let h = 0; h < 24; h++) {
    hourlyAgg[h] = { hour: h, sessions: 0, revenue: 0 };
  }
  data.forEach((d) => {
    const h = d.hourOfDay ?? d.hour;
    if (h !== undefined && hourlyAgg[h]) {
      hourlyAgg[h].sessions += d.sessions || 0;
      hourlyAgg[h].revenue += d.revenue || 0;
    }
  });
  const hourly = Object.values(hourlyAgg);
  const maxSessions = Math.max(...hourly.map((h) => h.sessions), 1);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-[600px]">
        {hourly.map((hour) => {
          const intensity = hour.sessions / maxSessions;
          const bgOpacity = Math.max(0.1, intensity);
          return (
            <div
              key={hour.hour}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full h-16 rounded-lg flex items-center justify-center text-xs font-medium"
                style={{
                  backgroundColor: `rgba(245, 158, 11, ${bgOpacity})`,
                  color: intensity > 0.5 ? '#1e293b' : '#94a3b8',
                }}
                title={`${hour.sessions} sessions`}
              >
                {hour.sessions}
              </div>
              <span className="text-[10px] text-slate-500">{hour.hour}:00</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableBreakdownRow({ table, maxRevenue }) {
  // Guard against undefined table
  if (!table) return null;
  
  const totalRevenue = table.totalRevenue ?? 0;
  const sessions = table.sessions ?? 0;
  const avgDuration = table.avgDuration ?? 0;
  const turnoversPerDay = table.turnoversPerDay ?? 0;
  
  const revenueWidth = maxRevenue > 0 ? (totalRevenue / maxRevenue) * 100 : 0;
  // Calculate revenue per hour based on sessions and average duration
  const totalHours = (sessions * (avgDuration || 60)) / 60;
  const revenuePerHour = totalHours > 0 ? totalRevenue / totalHours : 0;

  return (
    <div className="flex items-center gap-4 py-2 border-b border-slate-700/30 last:border-b-0">
      <div className="w-16 font-medium text-[var(--pos-text-primary)]">{table.tableLabel || 'Unknown'}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="flex items-center gap-1">
            <Users size={12} /> {sessions}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} /> {avgDuration}m
          </span>
          <span className="flex items-center gap-1">
            <RefreshCw size={12} /> {turnoversPerDay.toFixed(1)}x
          </span>
        </div>
        <div className="mt-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full"
            style={{ width: `${revenueWidth}%` }}
          />
        </div>
      </div>
      <div className="text-right min-w-[80px]">
        <p className="font-semibold text-[var(--pos-text-primary)]">
          ${totalRevenue.toFixed(0)}
        </p>
        <p className="text-xs text-slate-500">${revenuePerHour.toFixed(0)}/hr</p>
      </div>
    </div>
  );
}

function DayPartChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500">
        No day part data available
      </div>
    );
  }

  const maxSessions = Math.max(...data.map((d) => d.sessions || 0), 1);
  const colors = {
    breakfast: 'bg-yellow-500',
    morning: 'bg-yellow-500',
    lunch: 'bg-orange-500',
    afternoon: 'bg-amber-500',
    dinner: 'bg-red-500',
    late_night: 'bg-purple-500',
  };

  return (
    <div className="flex items-end gap-3 h-40">
      {data.map((part) => {
        if (!part || !part.dayPart) return null;
        const sessions = part.sessions || 0;
        const avgRevenue = part.avgRevenuePerCover ?? part.avgRevenue ?? 0;
        const height = (sessions / maxSessions) * 100;
        return (
          <div key={part.dayPart} className="flex-1 flex flex-col items-center gap-2">
            <div
              className={`w-full rounded-t-lg ${colors[part.dayPart] || 'bg-slate-500'}`}
              style={{ height: `${Math.max(height, 5)}%` }}
              title={`${sessions} sessions, $${avgRevenue.toFixed(0)} avg`}
            />
            <div className="text-center">
              <p className="text-xs font-medium text-[var(--pos-text-primary)] capitalize">
                {part.dayPart.replace('_', ' ')}
              </p>
              <p className="text-[10px] text-slate-500">{sessions}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TableAnalyticsPage() {
  const { selectedStoreId, isStoreReady } = useStoreContext();

  const today = new Date();
  const [dateRange, setDateRange] = useState({
    start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
    end: today.toISOString().split('T')[0],
  });

  // Fetch summary KPIs
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['table-analytics-summary', selectedStoreId, dateRange],
    queryFn: () =>
      api
        .get(`/table-analytics/summary?startDate=${dateRange.start}&endDate=${dateRange.end}`)
        .then((r) => r.data),
    enabled: isStoreReady,
  });

  // Fetch by-table breakdown
  const { data: byTableData, isLoading: byTableLoading } = useQuery({
    queryKey: ['table-analytics-by-table', selectedStoreId, dateRange],
    queryFn: () =>
      api
        .get(`/table-analytics/by-table?startDate=${dateRange.start}&endDate=${dateRange.end}`)
        .then((r) => r.data),
    enabled: isStoreReady,
  });
  const byTable = byTableData?.tables || [];

  // Fetch hourly heatmap
  const { data: hourlyData } = useQuery({
    queryKey: ['table-analytics-hourly', selectedStoreId, dateRange],
    queryFn: () =>
      api
        .get(`/table-analytics/by-hour?startDate=${dateRange.start}&endDate=${dateRange.end}`)
        .then((r) => r.data),
    enabled: isStoreReady,
  });
  const hourly = hourlyData?.heatmap || [];

  // Fetch day part breakdown
  const { data: dayPartsData } = useQuery({
    queryKey: ['table-analytics-day-parts', selectedStoreId, dateRange],
    queryFn: () =>
      api
        .get(`/table-analytics/by-day-part?startDate=${dateRange.start}&endDate=${dateRange.end}`)
        .then((r) => r.data),
    enabled: isStoreReady,
  });
  const dayParts = dayPartsData?.breakdown || [];

  const maxRevenue = useMemo(() => {
    return Math.max(...byTable.map((t) => t.totalRevenue || 0), 1);
  }, [byTable]);

  // Quick date range presets
  const setPreset = (preset) => {
    const end = new Date();
    let start;
    switch (preset) {
      case 'today':
        start = new Date();
        break;
      case 'week':
        start = new Date();
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        break;
      case 'quarter':
        start = new Date(end.getFullYear(), end.getMonth() - 3, 1);
        break;
      default:
        start = new Date(end.getFullYear(), end.getMonth(), 1);
    }
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  if (!isStoreReady) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
                <div className="flex-1 flex items-center justify-center">
          <p className="text-amber-300">Select a store in the header first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
      
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-amber-400" />
          <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Table Analytics</h1>
        </div>

        {/* Date Range Filter */}
        <FilterPanel summary={`${dateRange.start} → ${dateRange.end}`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-1 overflow-x-auto no-scrollbar">
              {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: '7 Days' },
                { key: 'month', label: 'Month' },
                { key: 'quarter', label: 'Quarter' },
              ].map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setPreset(preset.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap text-slate-400 hover:bg-slate-700/50 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="bg-transparent text-sm text-[var(--pos-text-primary)] outline-none"
              />
              <span className="text-slate-500">–</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="bg-transparent text-sm text-[var(--pos-text-primary)] outline-none"
              />
            </div>
          </div>
        </FilterPanel>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={Table}
            label="Total Sessions"
            value={summary?.totalSessions || 0}
            color="amber"
          />
          <KPICard
            icon={Clock}
            label="Avg Duration"
            value={Math.round(summary?.avgDuration || 0)}
            unit="min"
            color="teal"
          />
          <KPICard
            icon={RefreshCw}
            label="Avg Turnover"
            value={(summary?.turnoversPerDay || 0).toFixed(1)}
            unit="x/day"
            color="purple"
          />
          <KPICard
            icon={DollarSign}
            label="Avg Rev/Cover"
            value={`$${(summary?.avgRevenuePerCover || 0).toFixed(0)}`}
            color="green"
          />
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Hourly Heatmap */}
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
            <h3 className="font-semibold text-[var(--pos-text-primary)] mb-4 flex items-center gap-2">
              <Clock size={18} className="text-amber-400" />
              Hourly Occupancy
            </h3>
            <HourlyHeatmap data={hourly} />
          </div>

          {/* Day Part Breakdown */}
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
            <h3 className="font-semibold text-[var(--pos-text-primary)] mb-4 flex items-center gap-2">
              <Utensils size={18} className="text-amber-400" />
              Sessions by Day Part
            </h3>
            <DayPartChart data={dayParts} />
          </div>
        </div>

        {/* Table Breakdown */}
        <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
          <h3 className="font-semibold text-[var(--pos-text-primary)] mb-4 flex items-center gap-2">
            <Table size={18} className="text-amber-400" />
            Performance by Table
          </h3>
          {byTableLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              Loading...
            </div>
          ) : byTable.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500">
              No table data available
            </div>
          ) : (
            <div className="space-y-1">
              {byTable.map((table) => (
                <TableBreakdownRow
                  key={table.tableId}
                  table={table}
                  maxRevenue={maxRevenue}
                />
              ))}
            </div>
          )}
        </div>

        {/* Additional Metrics */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
            <h4 className="text-sm text-slate-400 mb-2">Total Revenue</h4>
            <p className="text-2xl font-bold text-[var(--pos-text-primary)]">
              ${(summary?.totalRevenue || 0).toFixed(0)}
            </p>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
            <h4 className="text-sm text-slate-400 mb-2">Avg Party Size</h4>
            <p className="text-2xl font-bold text-[var(--pos-text-primary)]">
              {(summary?.avgPartySize || 0).toFixed(1)}
            </p>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
            <h4 className="text-sm text-slate-400 mb-2">Total Covers</h4>
            <p className="text-2xl font-bold text-[var(--pos-text-primary)]">
              {summary?.totalCovers || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
