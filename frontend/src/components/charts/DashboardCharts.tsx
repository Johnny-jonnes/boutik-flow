'use client';

import {
  ResponsiveContainer, ComposedChart, AreaChart, BarChart, PieChart,
  Area, Bar, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { formatCompact, formatGNF, formatNumber } from '@/lib/format';

/**
 * Graphiques de l'accueil, chargés via next/dynamic (ssr:false) depuis
 * dashboard/page.tsx — même raison que RevenueTrendChart : Recharts (+ D3)
 * hors du bundle initial de la première page vue après connexion. Tous
 * dans un seul module pour ne produire qu'un chunk séparé.
 */

const tooltipStyle = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border-default)',
  borderRadius: 12,
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-lg)',
  fontSize: '0.82rem',
  padding: '0.55rem 0.75rem',
};
const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };

/* ── Mini-courbe de la carte Chiffre d'affaires ─────────────────────── */
export function Sparkline({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={2}
          fill="url(#sparkFill)" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Performance : CA (aire) + nombre de ventes (barres) ─────────────── */
export function SalesPerformanceChart({
  data,
  showRevenue,
  language,
}: {
  data: { name: string; revenue: number; orders: number }[];
  showRevenue: boolean;
  language: string;
}) {
  const fr = language === 'fr';
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 10, right: 4, left: -6, bottom: 0 }}>
        <defs>
          <linearGradient id="perfRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-400)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-brand-400)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="perfOrders" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--recharts-grid-stroke)" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axisTick} minTickGap={18} />
        {showRevenue && (
          <YAxis yAxisId="revenue" tickLine={false} axisLine={false} tick={axisTick} width={52}
            tickFormatter={(v) => formatCompact(v)} />
        )}
        <YAxis yAxisId="orders" orientation={showRevenue ? 'right' : 'left'} tickLine={false} axisLine={false}
          tick={axisTick} width={32} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--overlay-medium)' }}
          formatter={(value, key) => key === 'revenue'
            ? [formatGNF(Number(value)), fr ? "Chiffre d'affaires" : 'Revenue']
            : [formatNumber(Number(value)), fr ? 'Ventes' : 'Sales']}
        />
        <Bar yAxisId="orders" dataKey="orders" fill="url(#perfOrders)" radius={[5, 5, 0, 0]} maxBarSize={14} />
        {showRevenue && (
          <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="var(--color-brand-400)" strokeWidth={2.5}
            fill="url(#perfRevenue)" dot={false}
            activeDot={{ r: 5, fill: 'var(--color-brand-300)', stroke: 'var(--color-brand-600)', strokeWidth: 2 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ── Répartition par moyen de paiement (anneau) ─────────────────────── */
export function PaymentDonut({ data }: { data: { key: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="key" innerRadius={62} outerRadius={88}
          paddingAngle={data.length > 1 ? 3 : 0} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270}>
          {data.map((d) => <Cell key={d.key} fill={d.color} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Heures d'affluence (nombre de ventes par heure) ────────────────── */
export function PeakHoursChart({
  data,
  language,
}: {
  data: { hour: number; count: number }[];
  language: string;
}) {
  const max = Math.max(...data.map((d) => d.count), 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--recharts-grid-stroke)" />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(h) => `${h}h`} interval={1} />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--overlay-medium)' }}
          labelFormatter={(h) => `${h}h – ${Number(h) + 1}h`}
          formatter={(value) => [formatNumber(Number(value)), language === 'fr' ? 'Ventes' : 'Sales']}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={22}>
          {data.map((d) => (
            <Cell key={d.hour} fill={d.count === max && max > 0 ? 'var(--color-brand-400)' : 'var(--brand-alpha-30)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
