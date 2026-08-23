'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Extrait de dashboard/page.tsx pour être chargé via next/dynamic
 * (ssr:false) — Recharts (+ D3 en dépendance) s'exécutait sinon dans le
 * bundle initial du Dashboard, la toute première page vue après
 * connexion, alors que rien n'empêche de l'afficher juste après un
 * squelette de chargement léger.
 */
export default function RevenueTrendChart({
  chartData,
  language,
}: {
  chartData: { name: string; value: number }[];
  language: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-brand-400)" stopOpacity={0.25}/>
            <stop offset="95%" stopColor="var(--color-brand-400)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(val) => `${val / 1000}k`}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <Tooltip
          formatter={(value: any) => [`${new Intl.NumberFormat('fr-FR').format(value)} GNF`, language === 'fr' ? 'Chiffre d\'affaires' : 'Revenue']}
          contentStyle={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '0.85rem',
          }}
          cursor={{ stroke: 'var(--color-brand-400)', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-brand-400)"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorRevenue)"
          dot={false}
          activeDot={{ r: 5, fill: 'var(--color-brand-300)', stroke: 'var(--color-brand-500)', strokeWidth: 2 }}
          animationDuration={1200}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
