import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import QRCode from 'qrcode';
import { Activity } from 'lucide-react';
import { useChartColors, axisProps } from '../lib/hooks';
import { asList } from '../lib/api';
import { fmtShortDate, fmtDate } from '../lib/format';
import { EmptyState, ChartTip } from './ui';

/**
 * Attendance over time with the 75% rule drawn in.
 * `personal` turns per-day 0/1 rows into a cumulative running percentage.
 */
export function AttendanceTrend({ data, height = 230, personal, threshold = 75 }) {
  const c = useChartColors();
  const series = useMemo(() => {
    const rows = asList(data);
    if (!personal) return rows.map((r) => ({ date: r.date, value: r.percentage }));
    let held = 0;
    let attended = 0;
    return rows.map((r) => {
      held += r.total || 0;
      attended += (r.present || 0) + (r.society_present || 0) + (r.late || 0) * 0.5;
      return { date: r.date, value: held ? +((attended / held) * 100).toFixed(1) : null };
    });
  }, [data, personal]);

  if (!series.length) return <EmptyState icon={Activity} title="No attendance records yet" compact />;
  const lo = Math.min(...series.map((s) => s.value ?? 100), threshold - 5);
  const min = Math.max(0, Math.floor(lo / 10) * 10);
  const id = `att-${personal ? 'p' : 'c'}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 10, right: 6, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={c.accent} stopOpacity={0.22} />
            <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.line} />
        <XAxis dataKey="date" {...axisProps(c)} tickFormatter={(d) => fmtShortDate(d)} minTickGap={28} />
        <YAxis domain={[min, 100]} {...axisProps(c)} tickFormatter={(v) => `${v}%`} width={48} allowDecimals={false} />
        <ReferenceLine y={threshold} stroke={c.danger} strokeDasharray="4 4" label={{ value: `${threshold}% rule`, position: 'insideBottomRight', fill: c.danger, fontSize: 11 }} />
        <Tooltip content={<ChartTip format={(v) => `${v}%`} labelFormat={(d) => fmtDate(d)} />} cursor={{ stroke: c.lineStrong }} />
        <Area type="monotone" dataKey="value" name={personal ? 'Cumulative' : 'Present'} stroke={c.accent} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Real, scannable QR code rendered to an <img> */
export function QR({ value, size = 220 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { width: size * 2, margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111113', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [value, size]);
  return (
    <div className="qr-frame">
      {src ? <img src={src} width={size} height={size} alt={`QR code for ${value}`} /> : <div className="skeleton" style={{ width: size, height: size }} />}
    </div>
  );
}
