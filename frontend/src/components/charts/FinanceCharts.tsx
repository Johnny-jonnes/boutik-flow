'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { formatCompact, formatGNF } from '@/lib/format';

/**
 * Graphique de trésorerie de la page Finances (chargé via next/dynamic,
 * ssr:false — même raison que DashboardCharts : Recharts hors du bundle
 * initial). Barres entrées/sorties par période + courbe du solde cumulé.
 */
export function CashflowChart({
  data,
  language,
}: {
  data: { name: string; income: number; expense: number; balance: number }[];
  language: string;
}) {
  const fr = language === 'fr';
  const labels: Record<string, string> = {
    income: fr ? 'Entrées' : 'Income',
    expense: fr ? 'Sorties' : 'Expenses',
    balance: fr ? 'Solde cumulé' : 'Running balance',
  };
  return (
    <ResponsiveContainer width="100%" height={290}>
      <ComposedChart data={data} margin={{ top: 10, right: 4, left: -4, bottom: 0 }}>
        <defs>
          <linearGradient id="cfIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id="cfExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--recharts-grid-stroke)" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} minTickGap={16} />
        {/* Deux échelles : les flux du jour (barres) restent lisibles même
            quand le solde cumulé (courbe) devient bien plus grand. */}
        <YAxis yAxisId="flow" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={54}
          tickFormatter={(v) => formatCompact(v)} />
        <YAxis yAxisId="balance" orientation="right" hide domain={['auto', 'auto']} />
        <Tooltip
          cursor={{ fill: 'var(--overlay-medium)' }}
          contentStyle={{
            background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 12,
            color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)', fontSize: '0.82rem',
          }}
          formatter={(value, key) => [formatGNF(Number(value)), labels[String(key)] ?? String(key)]}
        />
        <Bar yAxisId="flow" dataKey="income" fill="url(#cfIncome)" radius={[5, 5, 0, 0]} maxBarSize={16} />
        <Bar yAxisId="flow" dataKey="expense" fill="url(#cfExpense)" radius={[5, 5, 0, 0]} maxBarSize={16} />
        <Line yAxisId="balance" type="monotone" dataKey="balance" stroke="var(--color-brand-400)" strokeWidth={2.5} dot={false}
          activeDot={{ r: 5, fill: 'var(--color-brand-300)', stroke: 'var(--color-brand-600)', strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
