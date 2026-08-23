'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ChartColors {
  grid: string;
  barFill0: string;
  barFill1: string;
  areaOrders: string;
  areaDelivered: string;
  areaOrdersFill: string;
  areaDeliveredFill: string;
}

/**
 * Extrait de analytics/page.tsx pour être chargé via next/dynamic
 * (ssr:false) — les 3 graphiques (Recharts + D3 en dépendance) sortis du
 * bundle initial de la page, remplacés par un squelette léger pendant
 * l'import. Regroupés en un seul composant (pas 3) : les 3 graphiques de
 * cette page s'affichent toujours ensemble, un seul chunk séparé au lieu
 * de 3 évite une cascade de mini-requêtes réseau au premier rendu.
 */
export default function AnalyticsCharts({
  period,
  revenueData,
  ordersData,
  topProducts,
  clientSegments,
  chartColors,
  t,
}: {
  period: string;
  revenueData: { name: string; value: number }[];
  ordersData: { name: string; commandes: number; livrees: number }[];
  topProducts: { name: string; ventes: number; revenue: number }[];
  clientSegments: { name: string; value: number; color: string }[];
  chartColors: ChartColors;
  t: (key: string) => string;
}) {
  return (
    <>
      {/* Charts Row */}
      <div className="analytics-charts">
        <div className="card analytics-chart-card">
          <h3 className="chart-title">Revenus ({period})</h3>
          <div className="chart-container">
            {revenueData.length === 0 ? (
              <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucune donnée de vente pour cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val.toLocaleString('fr-GN')}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                    formatter={(value: any) => [`${Number(value).toLocaleString('fr-GN')} GNF`, 'Revenus']}
                  />
                  <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.barFill0} />
                      <stop offset="100%" stopColor={chartColors.barFill1} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card analytics-chart-card">
          <h3 className="chart-title">{t('ana.orders_chart')}</h3>
          <div className="chart-container">
            {ordersData.length === 0 ? (
              <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucune commande pour cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={ordersData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="commandes" stroke={chartColors.areaOrders} fill={chartColors.areaOrdersFill} strokeWidth={2} />
                  <Area type="monotone" dataKey="livrees" stroke={chartColors.areaDelivered} fill={chartColors.areaDeliveredFill} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {ordersData.length > 0 && (
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot" style={{ background: chartColors.areaOrders }} /> {t('ana.orders')}</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: chartColors.areaDelivered }} /> {t('ana.delivered')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="analytics-bottom">
        <div className="card analytics-chart-card">
          <h3 className="chart-title">{t('ana.top_products')}</h3>
          <div className="top-products">
            {topProducts.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucun produit vendu sur cette période.
              </div>
            ) : (
              topProducts.map((product, i) => (
                <div key={i} className="top-product-row">
                  <div className="top-product-rank">#{i + 1}</div>
                  <div className="top-product-info">
                    <span className="top-product-name">{product.name}</span>
                    <span className="top-product-sales">{product.ventes} {t('ana.sales')}</span>
                  </div>
                  <div className="top-product-revenue">{Number(product.revenue).toLocaleString('fr-GN')} GNF</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card analytics-chart-card">
          <h3 className="chart-title">{t('ana.client_segments')}</h3>
          <div className="chart-container">
            {clientSegments.every(s => s.value === 0) ? (
              <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucun client dans la base de données.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={clientSegments} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {clientSegments.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    formatter={(value: any) => [`${value}%`, 'Part']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {!clientSegments.every(s => s.value === 0) && (
            <div className="chart-legend chart-legend--wrap">
              {clientSegments.map((s, i) => (
                <span key={i} className="legend-item"><span className="legend-dot" style={{ background: s.color }} /> {s.name} ({s.value}%)</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* styled-jsx scope aux éléments du MÊME fichier — dupliqué depuis
          analytics/page.tsx (laissé intact là-bas) plutôt que perdu ici,
          où ce JSX a été déplacé pour le chargement dynamique (voir
          l'en-tête du fichier). */}
      <style jsx>{`
        .analytics-charts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .analytics-bottom {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
          gap: 1.5rem;
        }
        .analytics-chart-card { padding: 1.5rem; }
        .chart-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 1.25rem;
        }
        .chart-container {
          width: 100%;
          min-height: 250px;
        }
        .chart-legend {
          display: flex;
          gap: 1.25rem;
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-subtle);
        }
        .chart-legend--wrap { flex-wrap: wrap; }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .top-products {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .top-product-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--overlay-subtle);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          transition: all 0.15s ease;
        }
        .top-product-row:hover {
          border-color: var(--border-default);
          background: var(--surface-hover);
        }
        .top-product-rank {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(37, 211, 102, 0.10);
          color: var(--color-brand-500);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8rem;
          flex-shrink: 0;
        }
        .top-product-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }
        .top-product-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .top-product-sales {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .top-product-revenue {
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--color-brand-500);
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .analytics-charts, .analytics-bottom {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
