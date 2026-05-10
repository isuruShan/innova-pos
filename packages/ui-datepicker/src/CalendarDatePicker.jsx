import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export function parseYmdToDate(s) {
  if (s == null || s === '') return undefined;
  const str = String(s).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return undefined;
  return dt;
}

export function dateToYmd(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDisplayYmd(ymd) {
  const d = parseYmdToDate(ymd);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function cmpDay(a, b) {
  const da = startOfDay(a).getTime();
  const db = startOfDay(b).getTime();
  return da === db ? 0 : da < db ? -1 : 1;
}

/** Weeks as arrays of 7 cells; null = empty pad */
function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const pad = first.getDay();
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Calendar popup date picker. Value is always `YYYY-MM-DD` (local calendar day).
 */
export function CalendarDatePicker({
  value,
  onChange,
  disabled = false,
  min,
  max,
  id,
  placeholder = 'Select date',
  buttonClassName = '',
  popoverClassName = '',
  align = 'left',
  theme = 'dark',
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverBox, setPopoverBox] = useState(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popW = 288;
    let left = align === 'right' ? r.right - popW : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
    const estH = 340;
    let top = r.bottom + 8;
    if (top + estH > window.innerHeight - 8) {
      top = Math.max(8, r.top - estH - 8);
    }
    setPopoverBox({ top, left, width: popW });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverBox(null);
      return undefined;
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  const selected = useMemo(() => parseYmdToDate(value), [value]);
  const minD = useMemo(() => parseYmdToDate(min), [min]);
  const maxD = useMemo(() => parseYmdToDate(max), [max]);

  const initialMonth = selected || new Date();
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- sync view when value jumps

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const weeks = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function dayDisabled(dt) {
    if (!dt) return true;
    if (minD && cmpDay(dt, minD) < 0) return true;
    if (maxD && cmpDay(dt, maxD) > 0) return true;
    return false;
  }

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const defaultDarkBtn =
    'w-full flex items-center justify-between gap-2 bg-[#0f172a] border border-slate-600 text-white rounded-xl px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed';
  const defaultLightBtn =
    'w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-gray-900 border-gray-300';

  const btnClass = buttonClassName || (theme === 'light' ? defaultLightBtn : defaultDarkBtn);

  const popBase =
    theme === 'light'
      ? 'rounded-xl border border-gray-200 bg-white p-3 shadow-lg box-border'
      : 'rounded-xl border border-slate-600 bg-[#1e293b] p-3 shadow-xl box-border';
  const popClass = `${popBase} ${popoverClassName}`.trim();

  const labelMuted = theme === 'light' ? 'text-gray-500' : 'text-slate-500';
  const navBtn = theme === 'light' ? 'p-1.5 rounded-lg hover:bg-gray-100 text-gray-600' : 'p-1.5 rounded-lg hover:bg-slate-700 text-slate-300';
  const dayBtn =
    theme === 'light'
      ? 'w-9 h-9 rounded-lg text-sm hover:bg-gray-100 text-gray-900'
      : 'w-9 h-9 rounded-lg text-sm hover:bg-slate-700 text-slate-200';
  const daySel = theme === 'light' ? 'bg-orange-500 text-white hover:bg-orange-500' : 'bg-amber-500 text-white hover:bg-amber-500';
  const dayToday =
    theme === 'light' ? 'ring-1 ring-orange-300' : 'ring-1 ring-amber-500/50';
  const dayOut = 'opacity-35 cursor-default';

  const title = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const today = startOfDay(new Date());

  const calendarPanel = (
    <>
      <div className={`flex items-center justify-between gap-2 mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
        <button type="button" className={navBtn} onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <span className="text-sm font-semibold">{title}</span>
        <button type="button" className={navBtn} onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </div>
      <div className={`grid grid-cols-7 gap-0.5 text-[10px] mb-1 ${labelMuted}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="w-9 text-center font-medium">
            {w}
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map((cell, ci) => {
              if (!cell) return <div key={`${wi}-e-${ci}`} className="w-9 h-9 shrink-0" />;
              const isSel = selected && cmpDay(cell, selected) === 0;
              const isToday = cmpDay(cell, today) === 0;
              const dis = disabled || dayDisabled(cell);
              return (
                <button
                  key={dateToYmd(cell)}
                  type="button"
                  disabled={dis}
                  onClick={() => {
                    if (dis) return;
                    onChange?.(dateToYmd(cell));
                    setOpen(false);
                  }}
                  className={`${dayBtn} ${isSel ? daySel : ''} ${!isSel && isToday ? dayToday : ''} ${dis ? dayOut : ''}`}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div ref={triggerRef} className="relative w-full min-w-0">
      <button
        type="button"
        id={id}
        disabled={disabled}
        className={btnClass}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="truncate">{value ? formatDisplayYmd(value) : placeholder}</span>
        <svg
          className="w-4 h-4 shrink-0 opacity-60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>
      {open &&
        popoverBox &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Calendar"
            style={{
              position: 'fixed',
              top: popoverBox.top,
              left: popoverBox.left,
              width: popoverBox.width,
              zIndex: 99999,
            }}
            className={popClass}
          >
            {calendarPanel}
          </div>,
          document.body
        )}
    </div>
  );
}
