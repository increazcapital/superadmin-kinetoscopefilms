/* ============================================================
   Component: BarChart.jsx
   Description: Horizontal bar chart showing agent contribution
   ============================================================ */

import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

export default function BarChart({ data, height = 280 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: `${height}px`, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        No data available
      </div>
    );
  }
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const maxVal = Math.max(...data.map(d => d.amount || 0), 1);

  const barHeight = 24;
  const gap = 8;
  const labelWidth = 125;
  const valueWidth = 85;
  const chartWidth = 540;
  const plotWidth = chartWidth - labelWidth - valueWidth - 20;
  const totalHeight = Math.max(data.length * (barHeight + gap) - gap, 10);

  return (
    <div className="kfpl-bar-h-chart-wrap" style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${totalHeight + 20}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: `${height}px` }}
      >
        <defs>
          <linearGradient id="barGradGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="barGradHover" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {data.map((item, i) => {
          const y = i * (barHeight + gap) + 10;
          const barW = (item.amount / maxVal) * plotWidth;
          const isHovered = hoveredIndex === i;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Agent name label */}
              <text
                x={labelWidth - 10}
                y={y + barHeight / 2 + 1}
                textAnchor="end"
                dominantBaseline="central"
                style={{
                  fontSize: '11px',
                  fill: isHovered ? '#10B981' : '#8892A4',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: isHovered ? 600 : 400,
                  transition: 'fill 0.2s ease',
                }}
              >
                {item.name}
              </text>

              {/* Background track */}
              <rect
                x={labelWidth}
                y={y}
                width={plotWidth}
                height={barHeight}
                rx={6}
                fill="rgba(208, 215, 226, 0.2)"
              />

              {/* Bar fill */}
              <rect
                x={labelWidth}
                y={y + (isHovered ? -1 : 0)}
                width={barW}
                height={barHeight + (isHovered ? 2 : 0)}
                rx={6}
                fill={isHovered ? 'url(#barGradHover)' : 'url(#barGradGold)'}
                style={{
                  transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1), height 0.2s ease, y 0.2s ease',
                  filter: isHovered ? 'drop-shadow(0 2px 8px rgba(16, 185, 129, 0.4))' : 'none',
                }}
              />

              {/* Rank badge */}
              {i < 3 && (
                <>
                  <circle
                    cx={labelWidth + 14}
                    cy={y + barHeight / 2}
                    r={9}
                    fill="rgba(13, 27, 42, 0.7)"
                  />
                  <text
                    x={labelWidth + 14}
                    y={y + barHeight / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fontSize: '9px',
                      fill: '#10B981',
                      fontWeight: 700,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    #{i + 1}
                  </text>
                </>
              )}

              {/* Value label */}
              <text
                x={labelWidth + plotWidth + 10}
                y={y + barHeight / 2 + 1}
                dominantBaseline="central"
                style={{
                  fontSize: '11px',
                  fill: isHovered ? '#1A1A2E' : '#3D4A5C',
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'fill 0.2s ease',
                }}
              >
                {formatCurrency(item.amount)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="kfpl-chart-tooltip"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            transform: 'none',
            left: 'auto',
          }}
        >
          {data[hoveredIndex].name} • {data[hoveredIndex].clients} clients • {formatCurrency(data[hoveredIndex].amount)}
        </div>
      )}
    </div>
  );
}

/* ============ END: BarChart.jsx ============ */
