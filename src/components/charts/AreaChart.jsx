/* ============================================================
   Component: AreaChart.jsx
   Description: Dual area chart — Investments vs Withdrawals
   ============================================================ */

import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

export default function AreaChart({ data, height = 260 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: `${height}px`, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        No data available
      </div>
    );
  }
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const padding = { top: 24, right: 20, bottom: 44, left: 14 };
  const chartWidth = 600;
  const chartHeight = height;
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const allValues = data.flatMap(d => [d.investments || 0, d.withdrawals || 0]);
  const maxVal = Math.max(...allValues, 1) * 1.15;

  const getX = (i) => padding.left + (i / (data.length > 1 ? data.length - 1 : 1)) * plotW;
  const getY = (val) => padding.top + plotH - ((val || 0) / maxVal) * plotH;

  // Create smooth bezier path
  const createSmoothPath = (points) => {
    if (points.length < 2) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
      const cp1y = points[i].y;
      const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
      const cp2y = points[i + 1].y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
    return path;
  };

  const investPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.investments || 0) }));
  const withdrawPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.withdrawals || 0) }));

  const investLine = createSmoothPath(investPoints);
  const withdrawLine = createSmoothPath(withdrawPoints);

  const baseY = padding.top + plotH;
  const investArea = `${investLine} L ${investPoints[investPoints.length - 1].x} ${baseY} L ${investPoints[0].x} ${baseY} Z`;
  const withdrawArea = `${withdrawLine} L ${withdrawPoints[withdrawPoints.length - 1].x} ${baseY} L ${withdrawPoints[0].x} ${baseY} Z`;

  // Grid lines
  const gridCount = 5;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const y = padding.top + (plotH / gridCount) * i;
    const val = maxVal - (maxVal / gridCount) * i;
    return { y, val };
  });

  return (
    <div className="kfpl-area-chart-wrap" style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${height}px` }}
      >
        <defs>
          <linearGradient id="areaGradInvest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A800" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F5A800" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="areaGradWithdraw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0E7490" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0E7490" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <g>
          {gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={g.y}
                x2={chartWidth - padding.right}
                y2={g.y}
                stroke="rgba(208, 215, 226, 0.3)"
                strokeDasharray="4 4"
              />
            </g>
          ))}
        </g>

        {/* Withdrawal area & line */}
        <path d={withdrawArea} fill="url(#areaGradWithdraw)" />
        <path
          d={withdrawLine}
          fill="none"
          stroke="#0E7490"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />

        {/* Investment area & line */}
        <path d={investArea} fill="url(#areaGradInvest)" />
        <path
          d={investLine}
          fill="none"
          stroke="#F5A800"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover crosshair */}
        {hoveredIndex !== null && (
          <>
            <line
              x1={getX(hoveredIndex)}
              y1={padding.top}
              x2={getX(hoveredIndex)}
              y2={baseY}
              stroke="rgba(245, 168, 0, 0.3)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Investment dot */}
            <circle
              cx={getX(hoveredIndex)}
              cy={getY(data[hoveredIndex].investments)}
              r="5"
              fill="#F5A800"
              stroke="#fff"
              strokeWidth="2"
            />
            {/* Withdrawal dot */}
            <circle
              cx={getX(hoveredIndex)}
              cy={getY(data[hoveredIndex].withdrawals)}
              r="4"
              fill="#0E7490"
              stroke="#fff"
              strokeWidth="2"
            />
          </>
        )}

        {/* Invisible hover areas */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={getX(i) - plotW / data.length / 2}
            y={padding.top}
            width={plotW / data.length}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ cursor: 'crosshair' }}
          />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={chartHeight - 8}
            textAnchor="middle"
            className="kfpl-line-chart-label"
          >
            {d.month}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="kfpl-area-chart-legend">
        <span className="kfpl-area-legend-item">
          <span className="kfpl-area-legend-dot" style={{ background: '#F5A800' }} />
          Investments
        </span>
        <span className="kfpl-area-legend-item">
          <span className="kfpl-area-legend-dot" style={{ background: '#0E7490' }} />
          Withdrawals
        </span>
      </div>

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="kfpl-chart-tooltip kfpl-area-tooltip"
          style={{
            left: `${(getX(hoveredIndex) / chartWidth) * 100}%`,
            top: '12px',
            transform: 'translateX(-50%)',
          }}
        >
          <strong>{data[hoveredIndex].month}</strong>
          <br />
          <span style={{ color: '#F5A800' }}>▲</span> {formatCurrency(data[hoveredIndex].investments)}
          <br />
          <span style={{ color: '#0E7490' }}>▼</span> {formatCurrency(data[hoveredIndex].withdrawals)}
        </div>
      )}
    </div>
  );
}

/* ============ END: AreaChart.jsx ============ */
