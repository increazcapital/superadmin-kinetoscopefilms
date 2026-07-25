/* ============================================================
   Component: BarChart.jsx (Agent Contribution Leaderboard)
   Description: Modern leaderboard component for agent contribution
   ============================================================ */

import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

const TrophyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '2px' }}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
    <path d="M4 22h16"></path>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>
  </svg>
);

export default function BarChart({ data, height = 280 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: `${height}px`, color: 'var(--color-text-muted)', fontSize: '0.875rem', gap: '8px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span>No agent contribution data available</span>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.amount || 0), 1);

  const getRankBadgeStyle = (index) => {
    switch (index) {
      case 0:
        return {
          bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          color: '#FFFFFF',
          shadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
          border: 'none',
          label: <><TrophyIcon />#1</>
        };
      case 1:
        return {
          bg: 'linear-gradient(135deg, #9CA3AF 0%, #4B5563 100%)',
          color: '#FFFFFF',
          shadow: '0 2px 6px rgba(156, 163, 175, 0.3)',
          border: 'none',
          label: '#2'
        };
      case 2:
        return {
          bg: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
          color: '#FFFFFF',
          shadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
          border: 'none',
          label: '#3'
        };
      default:
        return {
          bg: 'var(--color-surface, #F1F5F9)',
          color: 'var(--color-text-secondary, #475569)',
          shadow: 'none',
          border: '1px solid var(--color-border-light, #E2E8F0)',
          label: `#${index + 1}`
        };
    }
  };

  return (
    <div
      className="kfpl-agent-leaderboard-wrap"
      style={{
        width: '100%',
        maxHeight: `${height}px`,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '6px 8px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.map((item, i) => {
          const isHovered = hoveredIndex === i;
          const percentage = Math.min(100, Math.max(8, (item.amount / maxVal) * 100));
          const badgeStyle = getRankBadgeStyle(i);
          const nameInitials = (item.name || 'Agent').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

          return (
            <div
              key={item.id || item.name || i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: isHovered ? 'var(--color-surface-hover, #F8FAFC)' : 'var(--color-white, #FFFFFF)',
                border: isHovered ? '1.5px solid #10B981' : '1px solid var(--color-border-light, #E2E8F0)',
                boxShadow: isHovered ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                position: 'relative',
                boxSizing: 'border-box'
              }}
            >
              {/* Rank Badge */}
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  background: badgeStyle.bg,
                  color: badgeStyle.color,
                  border: badgeStyle.border,
                  boxShadow: badgeStyle.shadow,
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  letterSpacing: '0.3px',
                  flexShrink: 0,
                  minWidth: '52px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  lineHeight: 1
                }}
              >
                {badgeStyle.label}
              </div>

              {/* Agent Avatar */}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                }}
              >
                {nameInitials}
              </div>

              {/* Agent Details & Progress Bar */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary, #0F172A)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </span>
                    {item.code && (
                      <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', background: 'var(--color-surface, #F1F5F9)', padding: '1px 6px', borderRadius: '4px' }}>
                        {item.code}
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: '0.925rem', color: '#059669', flexShrink: 0, marginLeft: '12px' }}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>

                {/* Progress Track & Fill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '8px', background: 'var(--color-surface, #F1F5F9)', borderRadius: '9999px', overflow: 'hidden', position: 'relative' }}>
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: isHovered ? 'linear-gradient(90deg, #34D399 0%, #10B981 100%)' : 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                        borderRadius: '9999px',
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', flexShrink: 0 }}>
                    {item.clients || 1} {item.clients === 1 ? 'client' : 'clients'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
