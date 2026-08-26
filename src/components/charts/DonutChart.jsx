/* ============================================================
   Component: DonutChart.jsx
   Description: SVG donut/pie chart with center label
   ============================================================ */

import { useState } from 'react';

const SEGMENT_COLORS = ['#F5A800', '#1565C0', '#2E7D32', '#E65100', '#7B1FA2', '#00838F'];

export default function DonutChart({ data, size = 200, strokeWidth = 32 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: `${size}px`, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        No data available
      </div>
    );
  }
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate segment offsets
  let accumulated = 0;
  const segments = data.map((item, i) => {
    const percent = item.value / 100;
    const dashArray = circumference * percent;
    const dashOffset = circumference * (1 - accumulated / 100);
    accumulated += item.value;
    return {
      ...item,
      dashArray,
      dashOffset,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    };
  });

  return (
    <div className="kfpl-donut-wrap">
      <svg width={size} height={size} className="kfpl-donut">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-border-light)"
          strokeWidth={strokeWidth}
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
            strokeWidth={hoveredIndex === i ? strokeWidth + 4 : strokeWidth}
            strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
            strokeDashoffset={seg.dashOffset}
            className="kfpl-donut-segment"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              transition: 'stroke-width 0.2s ease',
              opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.6 : 1,
            }}
          />
        ))}
      </svg>
      <div className="kfpl-donut-center">
        <span className="kfpl-donut-center-value">
          {hoveredIndex !== null ? `${segments[hoveredIndex].value}%` : '6'}
        </span>
        <span className="kfpl-donut-center-label">
          {hoveredIndex !== null ? segments[hoveredIndex].segment : 'Segments'}
        </span>
      </div>
    </div>
  );
}

/* ============ END: DonutChart.jsx ============ */
