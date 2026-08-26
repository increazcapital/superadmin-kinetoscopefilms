/* ============================================================
   Component: PieChart.jsx
   Description: Investment status pie/donut chart (Active/Pending/Closed)
   ============================================================ */

import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

export default function PieChart({ data, size = 200, strokeWidth = 28, isCurrency = false }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: `${size}px`, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        No data available
      </div>
    );
  }
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, index: null });
  
  // Make it a solid pie chart with safety margins to prevent clipped edges on hover
  const actualStrokeWidth = (size - 24) / 2;
  const radius = (size - 24) / 4;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const totalCount = data.reduce((sum, d) => sum + (d.count || 0), 0);

  // Calculate segment offsets
  let accumulated = 0;
  const segments = data.map((item, i) => {
    const percent = (item.percentage || 0) / 100;
    const dashArray = circumference * percent;
    const dashOffset = circumference * (1 - accumulated / 100);
    accumulated += (item.percentage || 0);
    return {
      ...item,
      dashArray,
      dashOffset,
    };
  });

  return (
    <div className="kfpl-donut-wrap" style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} className="kfpl-donut" style={{ overflow: 'visible' }}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(208, 215, 226, 0.15)"
          strokeWidth={actualStrokeWidth}
        />
        {/* Segments */}
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={hoveredIndex === i ? actualStrokeWidth + 4 : actualStrokeWidth}
            strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
            strokeDashoffset={seg.dashOffset}
            className="kfpl-donut-segment"
            onMouseEnter={(e) => {
              setHoveredIndex(i);
              const rect = e.currentTarget.parentElement.getBoundingClientRect();
              setTooltip({
                show: true,
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                index: i
              });
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.parentElement.getBoundingClientRect();
              setTooltip(prev => ({
                ...prev,
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              }));
            }}
            onMouseLeave={() => {
              setHoveredIndex(null);
              setTooltip(prev => ({ ...prev, show: false, index: null }));
            }}
            style={{
              transition: 'stroke-width 0.25s ease, opacity 0.25s ease',
              opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.6 : 1,
              filter: hoveredIndex === i ? `drop-shadow(0 0 6px ${seg.color}44)` : 'none',
              cursor: 'pointer'
            }}
          />
        ))}
      </svg>

      {/* Floating Hover Tooltip Card */}
      {tooltip.show && tooltip.index !== null && segments[tooltip.index] && (
        <div 
          style={{
            position: 'absolute',
            top: `${tooltip.y - 75}px`,
            left: `${tooltip.x}px`,
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '11px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            zIndex: 1000,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            whiteSpace: 'nowrap',
            transition: 'top 0.08s ease, left 0.08s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: segments[tooltip.index].color }} />
            <span style={{ fontWeight: 600 }}>{segments[tooltip.index].status}</span>
          </div>
          <div style={{ color: '#F5A800', fontWeight: 700, fontSize: '13px', paddingLeft: '12px' }}>
            {isCurrency ? formatCurrency(segments[tooltip.index].count) : segments[tooltip.index].count}
          </div>
          <div style={{ color: '#94A3B8', fontSize: '10px', paddingLeft: '12px' }}>
            {segments[tooltip.index].percentage}% of total
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ END: PieChart.jsx ============ */
