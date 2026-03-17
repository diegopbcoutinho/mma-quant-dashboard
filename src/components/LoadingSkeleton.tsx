'use client';

export function KPISkeleton() {
  return (
    <section className="kpi-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="kpi-card glass-panel">
          <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
          <div className="skeleton skeleton-value"></div>
          <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
        </div>
      ))}
    </section>
  );
}

export function TableSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 40, marginBottom: 8, borderRadius: 6 }}
        ></div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <section className="chart-section glass-panel">
      <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: 16 }}></div>
      <div className="skeleton" style={{ height: 300, borderRadius: 8 }}></div>
    </section>
  );
}
