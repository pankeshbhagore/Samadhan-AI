import React from 'react';

export const SkeletonText = ({ width = '100%', height = 14 }) => (
  <div className="skeleton skeleton-text" style={{ width, height }} />
);

export const SkeletonStatCard = () => (
  <div className="stat-card">
    <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <SkeletonText width="60%" height={24} />
      <SkeletonText width="80%" height={12} />
    </div>
  </div>
);

export const SkeletonStatsGrid = ({ count = 4 }) => (
  <div className="grid grid-4" style={{ marginBottom: 24 }}>
    {Array.from({ length: count }).map((_, i) => <SkeletonStatCard key={i} />)}
  </div>
);

export const SkeletonTableRows = ({ rows = 6, cols = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: cols }).map((_, c) => (
          <td key={c}><SkeletonText width={c === 0 ? '70%' : '90%'} /></td>
        ))}
      </tr>
    ))}
  </>
);

export const SkeletonCardList = ({ count = 4 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
  </div>
);
