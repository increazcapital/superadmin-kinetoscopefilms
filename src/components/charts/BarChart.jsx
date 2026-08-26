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
          bg: 'linear-gradient(135deg, #F5A800 0%, #D48F00 100%)',
          color: '#FFFFFF',
          shadow: '0 2px 8px rgba(245, 168, 0, 0.35)',
          border: 'none',
          label: <><TrophyIcon />#1</>
        };
      case 1:
        return {
          bg: 'linear-gradient(135deg, #123A78 0%, #0B1F4D 100%)',
          color: '#FFFFFF',
          shadow: '0 2px 8px rgba(11, 31, 77, 0.25)',
          border: 'none',
          label: '#2'
        };
      case 2:
        return {
          bg: 'linear-gradient(135deg, #FFC83D 0%, #F5A800 100%)',
          color: '#0B1F4D',
          shadow: '0 2px 6px rgba(245, 168, 0, 0.25)',
          border: 'none',
          label: '#3'
        };
      default:
        return {
          bg: 'var(--color-surface, #F7F8FA)',
          color: 'var(--color-text-secondary, #1E3A5F)',
          shadow: 'none',
          border: '1px solid var(--color-border-light, #E4E9F1)',
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
        padding: '4px 2px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.map((item, i) => {
          const isHovered = hoveredIndex === i;
          const percentage = Math.min(100, Math.max(8, (item.amount / maxVal) * 100));
          const badgeStyle = getRankBadgeStyle(i);

          // Clean initials calculation (strips symbols so "Direct / Admin" -> "DA")
          const cleanName = (item.name || 'Agent').replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
          const nameInitials = cleanName
            .split(/\s+/)
            .filter(Boolean)
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'AG';

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
                background: isHovered ? '#FFFFFF' : 'var(--color-white, #FFFFFF)',
                border: isHovered ? '1.5px solid #F5A800' : '1px solid var(--color-border-light, #E4E9F1)',
                boxShadow: isHovered ? '0 6px 20px rgba(11, 31, 77, 0.08)' : '0 1px 3px rgba(11, 31, 77, 0.03)',
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
                  background: i === 0 
                    ? 'linear-gradient(135deg, #F5A800 0%, #D48F00 100%)' 
                    : i === 1 
                    ? 'linear-gradient(135deg, #123A78 0%, #0B1F4D 100%)' 
                    : 'linear-gradient(135deg, #FFC83D 0%, #F5A800 100%)',
                  color: (i === 2) ? '#0B1F4D' : '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(11, 31, 77, 0.12)',
                  border: '1.5px solid rgba(255, 255, 255, 0.4)'
                }}
              >
                {nameInitials}
              </div>

              {/* Agent Details & Progress Bar */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary, #0B1F4D)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </span>
                    {item.code && (
                      <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted, #7A8BA0)', background: 'var(--color-surface, #F7F8FA)', border: '1px solid var(--color-border-light, #E4E9F1)', padding: '1px 6px', borderRadius: '4px' }}>
                        {item.code}
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#F5A800', flexShrink: 0, marginLeft: '12px' }}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>

                {/* Progress Track & Fill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '8px', background: '#EEF0F4', borderRadius: '9999px', overflow: 'hidden', position: 'relative' }}>
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #F5A800 0%, #FFC83D 100%)',
                        borderRadius: '9999px',
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 2px 6px rgba(245, 168, 0, 0.35)'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted, #7A8BA0)', flexShrink: 0 }}>
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
