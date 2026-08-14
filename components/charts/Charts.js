'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatMoney, formatNumber } from '@/lib/utils/format';

const AXIS = { fontSize: 11, fill: '#6b7688' };
const GRID = '#eef0f5';

const shortDate = (value) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function TooltipCard({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="sp-card sp-card-pad"
      style={{ padding: '10px 12px', fontSize: 13, boxShadow: 'var(--sp-shadow-lg)' }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{shortDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: <strong>{formatter ? formatter(entry.value) : formatNumber(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ data, currency = 'USD', height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d5afe" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#3d5afe" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={62}
          tickFormatter={(v) => formatMoney(v, currency, { compact: true })}
        />
        <Tooltip content={<TooltipCard formatter={(v) => formatMoney(v, currency)} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#3d5afe"
          strokeWidth={2}
          fill="url(#spRevenue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OrdersChart({ data, height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
        <Tooltip content={<TooltipCard />} cursor={{ fill: 'rgba(61,90,254,0.06)' }} />
        <Bar dataKey="orders" name="Orders" fill="#3d5afe" radius={[5, 5, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RefundsChart({ data, currency = 'USD', height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={62}
          tickFormatter={(v) => formatMoney(v, currency, { compact: true })}
        />
        <Tooltip content={<TooltipCard formatter={(v) => formatMoney(v, currency)} />} cursor={{ fill: 'rgba(217,45,32,0.06)' }} />
        <Bar dataKey="refundAmount" name="Refunds" fill="#d92d20" radius={[5, 5, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AlertTrendChart({ data, height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
        <Tooltip content={<TooltipCard />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="critical" name="Critical" stroke="#d92d20" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="warning" name="Warning" stroke="#dc6803" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
