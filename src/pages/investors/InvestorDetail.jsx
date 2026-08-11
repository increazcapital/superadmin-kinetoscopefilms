/* ============================================================
   Page: InvestorDetail.jsx
   Description: Investor profile with tabs for investments, ROI, perks
   ============================================================ */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';
import { getSWRCache, setSWRCache, invalidateSWRCache } from '../../utils/swrHelper';
import { getApiUrl } from '../../config/apiUrl';
import { usePermissions } from '../../utils/usePermissions';
import { getAuthToken } from '../../utils/authStorage';
import SensitiveValueToggle from '../../components/common/SensitiveValueToggle';
const formatClientID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  if (rawId.startsWith('KFPL-CL-')) return rawId;
  const digits = rawId.match(/\d+/);
  if (digits) {
    let val = parseInt(digits[0], 10);
    if (val < 1000) {
      val = 1000 + val;
    }
    return `KFPL-CL-${val}`;
  }
  return 'KFPL-CL-1001';
};

/* ── helpers for downloading statements ─────────────────────── */
/* Description Formatter for Multi-line / Bullet Point Texts */
const renderFormattedDescription = (desc) => {
  if (!desc) return null;
  const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 1 && !lines[0].endsWith(':') && !lines[0].includes('•')) {
    return (
      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '3px', lineHeight: 1.4 }}>
        {desc}
      </span>
    );
  }

  return (
    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
      {lines.map((line, idx) => {
        const isHeader = line.endsWith(':') || line.toLowerCase().includes('points:') || line.toLowerCase().includes('includes:');
        if (isHeader) {
          return (
            <div key={idx} style={{ fontWeight: 700, color: 'var(--color-navy)', marginTop: idx > 0 ? '8px' : '3px', marginBottom: '4px', fontSize: '0.825rem' }}>
              {line}
            </div>
          );
        }

        const isFirstIntro = idx === 0 && !line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*') && !/^\d+\./.test(line);
        if (isFirstIntro) {
          return (
            <div key={idx} style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginBottom: '6px', lineHeight: 1.4 }}>
              {line}
            </div>
          );
        }

        const cleanText = line.replace(/^[•\-\*\d+\.]+\s*/, '');
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '3px', paddingLeft: '4px' }}>
            <span style={{ color: '#10B981', fontWeight: 'bold', fontSize: '0.8rem', lineHeight: '1.3' }}>✓</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', lineHeight: 1.35 }}>{cleanText}</span>
          </div>
        );
      })}
    </div>
  );
};

function downloadClientROISingleCSV(roi, client) {
  const cName = client.name || client.fullName || 'Client';
  const rows = [
    ['ROI Payout Statement'],
    ['Client Name', cName],
    ['Client ID', client.clientId],
    ['Period / Month', roi.month],
    ['Payout Date', new Date(roi.paidAt || roi.date || new Date()).toLocaleDateString('en-IN')],
    ['ROI Amount', `₹${roi.amount}`],
    ['Status', roi.status],
  ];
  const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ROI_Statement_${roi.month.replace(/\s/g, '_')}_${cName.replace(/\s/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadClientROISinglePDF(roi, client) {
  const cName = client.name || client.fullName || 'Client';
  const dateStr = new Date(roi.paidAt || roi.date || new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const investments = client.investments || [];

  const formatDateStr = (dateVal) => {
    if (!dateVal || dateVal === '—' || dateVal === '-') return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      return d.toLocaleDateString('en-IN');
    } catch (e) {
      return dateVal;
    }
  };

  const rowsHtml = investments.map(inv => {
    const amt = inv.investmentAmount || inv.amount || 0;
    const rate = inv.roiPercentage || inv.roi || client.roiPercent || client.roiPercentage || 0;
    const monthlyROI = Math.round((amt * rate) / 100);
    
    const startDate = formatDateStr(inv.allocationDate || inv.investmentDate || client.contractStartDate);
    const endDate = formatDateStr(client.contractEndDate);
    const contractPeriodText = startDate !== '—' && endDate !== '—' ? `${startDate} to ${endDate}` : (endDate !== '—' ? endDate : '—');

    return `
      <tr>
        <td style="border: 1px solid #CFDDD5; padding: 10px; font-weight: 500;">${inv.segment}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">${startDate}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">${contractPeriodText}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: 600;">₹${amt.toLocaleString('en-IN')}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right;">${rate}%</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: bold; color: #0F766E;">₹${monthlyROI.toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Popup blocked! Please allow popups for this site to generate and print statements.');
    return;
  }
  printWindow.document.write(`
    <html>
    <head>
      <title>ROI Payout Statement - ${roi.month} - ${cName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #11221A; background-color: #FFFFFF; padding: 40px; margin: 0; }
        .header { margin-bottom: 30px; border-bottom: 3px solid #0F766E; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .title { font-size: 28px; font-weight: 800; color: #061D13; margin: 0; text-transform: uppercase; letter-spacing: -0.5px; }
        .meta-info { margin-bottom: 30px; background-color: #F3F7F5; border: 1px solid #CFDDD5; border-radius: 12px; padding: 20px; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .meta-item { display: flex; justify-content: space-between; border-bottom: 1px solid #E2ECE7; padding-bottom: 6px; font-size: 14px; }
        .meta-label { font-weight: 600; color: #6D7E75; }
        .meta-val { font-weight: 700; color: #11221A; }
        .section-title { font-size: 18px; font-weight: 700; color: #061D13; margin-top: 40px; margin-bottom: 14px; border-bottom: 1.5px solid #CFDDD5; padding-bottom: 6px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        .table th { background-color: #E5ECE8; border: 1px solid #CFDDD5; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2E3E36; letter-spacing: 0.5px; }
        .table td { border: 1px solid #CFDDD5; padding: 10px 12px; color: #11221A; }
        .total-row { background-color: #F3F7F5; font-weight: bold; }
        @media print {
          body { padding: 0; }
          .print-btn-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar" style="display: flex; justify-content: flex-end; margin-bottom: 20px; gap: 10px;">
        <button onclick="window.print();" style="background: #0F766E; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.2);">Print / Save PDF</button>
        <button onclick="window.close();" style="background: #e2ece7; color: #2e3e36; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px;">Close Window</button>
      </div>

      <div class="header">
        <div>
          <div class="title">ROI Payout Statement</div>
          <div style="font-size: 12px; color: #6D7E75; margin-top: 4px; font-weight: 500;">KINETOSCOPE CAPITAL PARTNERS LTD</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 600; color: #2E3E36;">Date Generated:</div>
          <div style="font-size: 14px; font-weight: 700; color: #11221A;">${new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </div>
      
      <div class="meta-info">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Client Name:</span>
            <span class="meta-val">${cName}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Client ID:</span>
            <span class="meta-val">${client.clientId}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Period:</span>
            <span class="meta-val">${roi.month}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payout Date:</span>
            <span class="meta-val">${dateStr}</span>
          </div>
          <div class="meta-item" style="grid-column: span 2; border-bottom: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #CFDDD5;">
            <span class="meta-label" style="font-size: 16px; color: #061D13;">Total ROI Received:</span>
            <span class="meta-val" style="font-size: 20px; color: #059669;">₹${roi.amount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
      
      <div class="section-title">Active Investments Breakdown</div>
      <table class="table">
        <thead>
          <tr>
            <th>Segment</th>
            <th style="text-align: center;">Start Date</th>
            <th style="text-align: center;">Contract Period</th>
            <th style="text-align: right;">Principal Investment</th>
            <th style="text-align: right;">Allocated Monthly ROI %</th>
            <th style="text-align: right;">Proportional Monthly ROI</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function downloadAllClientROICSV(roiList, client) {
  const cName = client.name || client.fullName || 'Client';
  const rows = [
    ['Client ROI Statement History'],
    ['Client Name', cName],
    ['Client ID', client.clientId],
    [''],
    ['Month', 'ROI Amount', 'Payment Date', 'Status']
  ];
  roiList.forEach(roi => {
    rows.push([
      roi.month,
      roi.amount,
      roi.paidAt || roi.date || '—',
      roi.status
    ]);
  });
  const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ROI_Statement_All_${cName.replace(/\s/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAllClientROIPDF(roiList, client) {
  const cName = client.name || client.fullName || 'Client';
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Popup blocked! Please allow popups for this site to generate and print statements.');
    return;
  }
  const totalReceived = roiList.reduce((sum, r) => sum + r.amount, 0);

  const rowsHtml = roiList.map(roi => {
    return `
      <tr>
        <td style="border: 1px solid #CFDDD5; padding: 10px; font-weight: 500;">${roi.month}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: bold; color: ${roi.amount > 0 ? '#059669' : '#11221A'};">₹${roi.amount.toLocaleString('en-IN')}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">${roi.paidAt || roi.date || '—'}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center; color: ${roi.status === 'paid' ? '#059669' : '#D97706'}; font-weight: 600;">${roi.status.toUpperCase()}</td>
      </tr>
    `;
  }).join('');

  printWindow.document.write(`
    <html>
    <head>
      <title>ROI Statement History - ${cName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #11221A; background-color: #FFFFFF; padding: 40px; margin: 0; }
        .header { margin-bottom: 30px; border-bottom: 3px solid #0F766E; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .title { font-size: 28px; font-weight: 800; color: #061D13; margin: 0; text-transform: uppercase; letter-spacing: -0.5px; }
        .meta-info { margin-bottom: 30px; background-color: #F3F7F5; border: 1px solid #CFDDD5; border-radius: 12px; padding: 20px; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .meta-item { display: flex; justify-content: space-between; border-bottom: 1px solid #E2ECE7; padding-bottom: 6px; font-size: 14px; }
        .meta-label { font-weight: 600; color: #6D7E75; }
        .meta-val { font-weight: 700; color: #11221A; }
        .section-title { font-size: 18px; font-weight: 700; color: #061D13; margin-top: 40px; margin-bottom: 14px; border-bottom: 1.5px solid #CFDDD5; padding-bottom: 6px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        .table th { background-color: #E5ECE8; border: 1px solid #CFDDD5; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2E3E36; letter-spacing: 0.5px; }
        .table td { border: 1px solid #CFDDD5; padding: 10px 12px; color: #11221A; }
        .total-row { background-color: #F3F7F5; font-weight: bold; }
        @media print {
          body { padding: 0; }
          .print-btn-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar" style="display: flex; justify-content: flex-end; margin-bottom: 20px; gap: 10px;">
        <button onclick="window.print();" style="background: #0F766E; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.2);">Print / Save PDF</button>
        <button onclick="window.close();" style="background: #e2ece7; color: #2e3e36; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px;">Close Window</button>
      </div>

      <div class="header">
        <div>
          <div class="title">ROI Statement History</div>
          <div style="font-size: 12px; color: #6D7E75; margin-top: 4px; font-weight: 500;">KINETOSCOPE CAPITAL PARTNERS LTD</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 600; color: #2E3E36;">Date Generated:</div>
          <div style="font-size: 14px; font-weight: 700; color: #11221A;">${new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </div>
      
      <div class="meta-info">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Client Name:</span>
            <span class="meta-val">${cName}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Client ID:</span>
            <span class="meta-val">${client.clientId}</span>
          </div>
          <div class="meta-item" style="grid-column: span 2; border-bottom: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #CFDDD5;">
            <span class="meta-label" style="font-size: 16px; color: #061D13;">Total ROI Received:</span>
            <span class="meta-val" style="font-size: 20px; color: #059669;">₹${totalReceived.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
      
      <div class="section-title">ROI Payment Log</div>
      <table class="table">
        <thead>
          <tr>
            <th>Month / Period</th>
            <th style="text-align: right;">ROI Received</th>
            <th style="text-align: center;">Payment Date</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="total-row">
            <td style="text-align: left; font-weight: 800; font-size: 14px; padding: 12px;">Total Summary</td>
            <td style="text-align: right; font-weight: 800; color: #059669; font-size: 14px; padding: 12px;">₹${totalReceived.toLocaleString('en-IN')}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ── SVG Icon Definitions ───────────────────────
const tabIcons = {
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  investments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  roi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  perks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  documents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
};

const infoIcons = {
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  fileText: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  landmark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><path d="M18 12a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4v-6z" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
};

const perkDetails = {
  'Priority Support': { desc: 'Direct 24/7 dedicated support helpline and query resolution within 2 hours.', icon: '📞' },
  'Annual Gala Invite': { desc: 'Complimentary premium access and VIP seating at the annual film gala and awards.', icon: '🎟️' },
  'Quarterly Review': { desc: 'One-on-one portfolio review sessions with senior investment strategists.', icon: '📊' },
  'Film Set Visit': { desc: 'Exclusive behind-the-scenes access to active KFPL production sets and meet & greet.', icon: '🎬' },
  'VIP Screening': { desc: 'Private premiere screening invites for upcoming movie and content releases.', icon: '🍿' },
  'Revenue Share Bonus': { desc: 'Additional 1.5% bonus payout on high-performing distribution segments.', icon: '💰' }
};

export default function InvestorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [activeTab, setActiveTab] = useState('profile');

  // ── API-driven state ─────────────────────────
  const [loading, setLoading] = useState(true);
  const [investor, setInvestor] = useState(null);
  const [investmentsData, setInvestmentsData] = useState(null);
  const [roiData, setRoiData] = useState(null);
  const [perksData, setPerksData] = useState(null);
  const [docsData, setDocsData] = useState(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [clientProfileId, setClientProfileId] = useState(id);

  const [localRiskProfile, setLocalRiskProfile] = useState('Conservative');
  const [localStatus, setLocalStatus] = useState('active');
  const [localRoiPercentage, setLocalRoiPercentage] = useState(0);
  const [showRoiEditModal, setShowRoiEditModal] = useState(false);
  const [roiEditStep, setRoiEditStep] = useState(1);
  const [roiInputVal, setRoiInputVal] = useState('0');
  const [verifiedDocs, setVerifiedDocs] = useState({});
  const [viewingDoc, setViewingDoc] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!viewingDoc || !viewingDoc.url) {
      setPreviewUrl('');
      return;
    }
    
    let active = true;
    let objUrl = '';

    const loadPreview = async () => {
      setPreviewLoading(true);
      try {
        const targetUrl = normalizeUrl(viewingDoc.url);
        const isCloudinary = targetUrl.includes('cloudinary.com') || targetUrl.includes('res.cloudinary.com');
        
        const headers = {};
        if (!isCloudinary) {
          const token = getAuthToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch(targetUrl, { headers });
        if (!response.ok) throw new Error('Fetch failed');
        const blob = await response.blob();
        
        if (active) {
          objUrl = URL.createObjectURL(blob);
          setPreviewUrl(objUrl);
        }
      } catch (err) {
        console.error('Preview fetch error:', err);
        if (active) {
          setPreviewUrl(normalizeUrl(viewingDoc.url));
        }
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (objUrl) {
        URL.revokeObjectURL(objUrl);
      }
    };
  }, [viewingDoc]);

  // ── API 2: Fetch client details & tab data on mount concurrently ─────
  useEffect(() => {
    // --- User-Scoped SWR Cache Initialization for Instant Load (0ms) ---
    try {
      const parsed = getSWRCache(`sa_client_detail_${id}`);
      if (parsed) {
        if (parsed.investor) setInvestor(parsed.investor);
        if (parsed.investmentsData) setInvestmentsData(parsed.investmentsData);
        if (parsed.roiData) setRoiData(parsed.roiData);
        if (parsed.perksData) setPerksData(parsed.perksData);
        if (parsed.docsData) setDocsData(parsed.docsData);
        if (parsed.verifiedDocs) setVerifiedDocs(parsed.verifiedDocs);
        if (parsed.clientProfileId) setClientProfileId(parsed.clientProfileId);
        setLoading(false);
      }
    } catch (e) {
      console.warn('Failed to parse client detail cache:', e);
    }

  const handleMarkRoiPaid = async (roi) => {
    try {
      const payoutId = roi._id || roi.id;
      const res = await apiRequest(`/api/super-admin/clients/${id}/roi/${payoutId}/pay`, {
        method: 'PATCH'
      });
      addToast('ROI payout marked as PAID successfully!', 'success');

      setRoiData(prev => {
        const list = (prev?.roiHistory || []).map(item => {
          if ((item._id || item.id) === payoutId) {
            return { ...item, status: 'PAID', processedDate: new Date().toISOString().split('T')[0] };
          }
          return item;
        });
        return { ...prev, roiHistory: list };
      });
    } catch (err) {
      console.error('Error marking ROI paid:', err);
      addToast(err.message || 'Failed to mark ROI paid', 'error');
    }
  };

  const handleVerifyDocument = async (docLabel) => {
    try {
      let fieldKey = 'panDocument';
      if (docLabel.includes('ID Proof') || docLabel.includes('Aadhaar')) fieldKey = 'aadhaarDocument';
      else if (docLabel.includes('Bank')) fieldKey = 'bankProofDocument';
      else if (docLabel.includes('Agreement')) fieldKey = 'agreementDocument';
      else if (docLabel.includes('Nominee')) fieldKey = 'nomineeProofDocument';

      setVerifiedDocs(prev => ({ ...prev, [docLabel]: true }));

      const res = await apiRequest(`/api/super-admin/clients/${id}/verify-document`, {
        method: 'PATCH',
        body: JSON.stringify({ documentField: fieldKey })
      });

      if (res && (res.success || res.status === 'success')) {
        addToast(`Document "${docLabel}" verified successfully!`, 'success');
      } else {
        addToast(res?.message || 'Failed to verify document.', 'error');
      }
    } catch (err) {
      console.error('Verify document error:', err);
      addToast(err.message || 'Error verifying document.', 'error');
    }
  };

    const fetchAllClientData = async () => {
      try {
        const clientRes = await apiRequest(`/api/super-admin/clients/${id}`).catch(err => {
          console.error('Failed to fetch client profile details:', err);
          return null;
        });

        let profileId = id;
        if (clientRes) {
          const data = clientRes.data || clientRes;
          const profile = data.profile || data;
          profileId = profile._id || data._id || id;
          setClientProfileId(profileId);
        }

        const [investmentsRes, roiRes, perksRes, docsRes] = await Promise.all([
          apiRequest(`/api/super-admin/clients/${profileId}/investments`).catch(err => {
            console.error('Failed to fetch investments:', err);
            return null;
          }),
          apiRequest(`/api/super-admin/roi/payouts?status=All&recipientType=All`).catch(err => {
            console.error('Failed to fetch ROI payouts:', err);
            return null;
          }),
          apiRequest(`/api/super-admin/clients/${profileId}/perks`).catch(err => {
            console.error('Failed to fetch perks:', err);
            return null;
          }),
          apiRequest(`/api/super-admin/clients/${profileId}/documents`).catch(err => {
            console.error('Failed to fetch documents:', err);
            return null;
          })
        ]);

        let allDocsVerifiedOnLoad = false;
        const verifiedMap = {};
        if (docsRes) {
          const data = docsRes.data || docsRes;
          const docs = data.documents || [];
          allDocsVerifiedOnLoad = docs.length > 0;
          docs.forEach(doc => {
            const label = doc.name || doc.label;
            const s = (doc.status || '').toLowerCase();
            const isDocVerified = s === 'verified' || s === 'approved' || doc.verified === true;
            if (isDocVerified) {
              verifiedMap[label] = true;
            } else {
              allDocsVerifiedOnLoad = false;
            }
          });
        }

        let inv = null;
        if (clientRes) {
          const data = clientRes.data || clientRes;
          const profile = data.profile || data;
          const header = data.header || {};
          const summary = data.summaryCards || {};

          let kycStatus = (header.kycStatus || summary.kycStatus || profile.kycStatus || 'PENDING').toUpperCase();
          if (allDocsVerifiedOnLoad) {
            kycStatus = 'VERIFIED';
          }

          inv = {
            _id: id,
            name: header.clientName || profile.fullName || profile.name || '',
            clientId: formatClientID(header.clientCode || profile.clientCode || profile.clientId || ''),
            email: profile.email || '',
            phone: profile.phone || '',
            dob: profile.dob ? new Date(profile.dob).toLocaleDateString('en-IN') : '—',
            address: profile.address || '—',
            joinDate: (data.joinDate || profile.joinDate) ? new Date(data.joinDate || profile.joinDate).toLocaleDateString('en-IN') : '—',
            contractStartDate: (data.contractStartDate || profile.contractStartDate) ? new Date(data.contractStartDate || profile.contractStartDate).toLocaleDateString('en-IN') : '—',
            rawContractStartDate: data.contractStartDate || profile.contractStartDate || data.joinDate || profile.joinDate || null,
            contractEndDate: (data.contractEndDate || profile.contractEndDate) ? new Date(data.contractEndDate || profile.contractEndDate).toLocaleDateString('en-IN') : '—',
            extendContractDate: (data.extendContractDate || profile.extendContractDate || data.contractExtendedDate || profile.contractExtendedDate) ? new Date(data.extendContractDate || profile.extendContractDate || data.contractExtendedDate || profile.contractExtendedDate).toLocaleDateString('en-IN') : '—',
            category: (header.tier || profile.tier || 'silver').toLowerCase(),
            status: (header.status || profile.status || 'active').toLowerCase(),
            kyc: kycStatus,
            riskProfile: header.riskProfile || profile.riskProfile || 'Conservative',
            totalInvestment: summary.totalInvestment || profile.totalPortfolioValue || 0,
            roiPercentage: summary.monthlyRoi ?? profile.monthlyRoi ?? 0,
            activeSegments: summary.activeSegments !== undefined ? summary.activeSegments : (summary.activeInvestments || 0),
            pan: profile.panNumber || profile.pan || '—',
            aadhaar: profile.aadhaarNumber || profile.aadhaar || '—',
            residencyStatus: profile.residencyStatus || 'National (Domestic)',
            bankName: profile.bankName || '—',
            accountNo: profile.accountNumber || profile.accountNo || '—',
            ifsc: profile.ifscCode || profile.ifsc || '—',
            nominee: {
              name: profile.nomineeName || '',
              relation: profile.nomineeRelation || '',
              phone: profile.nomineePhone || '',
              email: profile.nomineeEmail || '',
            },
            investments: [],
            roiHistory: [],
            perks: [],
            profilePic: header.profilePic || profile.profilePic || data.user?.profilePic || data.profilePic || '',
          };

          setInvestor(inv);
          setLocalRiskProfile(inv.riskProfile);
          setLocalStatus(inv.status);
          setLocalRoiPercentage(inv.roiPercentage);
          setRoiInputVal(String(inv.roiPercentage));
        }

        if (investmentsRes) {
          setInvestmentsData(investmentsRes.data || investmentsRes);
        } else {
          setInvestmentsData({ investments: [] });
        }

        let clientRoiHistory = [];
        if (roiRes) {
          const data = roiRes.data || roiRes;
          let extractedPayouts = [];
          if (Array.isArray(data)) {
            extractedPayouts = data;
          } else if (data.roiHistory && Array.isArray(data.roiHistory)) {
            extractedPayouts = data.roiHistory;
          } else if (data.payouts && Array.isArray(data.payouts)) {
            extractedPayouts = data.payouts;
          } else if (data.list && Array.isArray(data.list)) {
            extractedPayouts = data.list;
          }

          clientRoiHistory = extractedPayouts.map(r => {
            const rawRate = r.roiRate || r.roiPercentage || r.rate || localRoiPercentage || 0;
            const cleanRate = String(rawRate).replace('%', '').trim();
            const displayRate = cleanRate && cleanRate !== '0' ? `${cleanRate}%` : `${localRoiPercentage || 0}%`;
            return {
              ...r,
              _id: r.id || r._id,
              payoutMonth: r.payoutMonth || r.month || r.period || 'Aug 2026',
              roiRate: displayRate,
              amount: Number(r.amount || 0),
              status: (r.status || 'PENDING').toUpperCase(),
              processedDate: r.processedDate || r.paidAt || r.date || '—',
            };
          });

          setRoiData({
            roiHistory: clientRoiHistory,
            totalRoiPaid: data.totalRoiPaid || 0,
            totalRoiPending: data.totalRoiPending || 0
          });
        } else {
          setRoiData({ roiHistory: [], totalRoiPaid: 0, totalRoiPending: 0 });
        }

        if (perksRes) {
          setPerksData(perksRes.data || perksRes);
        } else {
          setPerksData({ perks: [] });
        }

        if (docsRes) {
          const data = docsRes.data || docsRes;
          setDocsData(data);
          setVerifiedDocs(verifiedMap);
        } else {
          setDocsData({ documents: [] });
        }

        // Save fresh values to SWR Cache safely (wrap in try/catch to handle QuotaExceededError)
        try {
          if (inv) {
            const cachedInv = { ...inv };
            if (cachedInv.profilePic && cachedInv.profilePic.length > 2000) {
              delete cachedInv.profilePic;
            }
            setSWRCache(`sa_client_detail_${id}`, {
              investor: cachedInv,
              investmentsData: investmentsRes ? (investmentsRes.data || investmentsRes) : { investments: [] },
              roiData: { roiHistory: clientRoiHistory },
              perksData: perksRes ? (perksRes.data || perksRes) : { perks: [] },
              docsData: docsRes ? (docsRes.data || docsRes) : { documents: [] },
              verifiedDocs: verifiedMap,
              clientProfileId: profileId
            });
          }
        } catch (cacheErr) {
          console.warn('SWR Cache write ignored due to quota limit:', cacheErr);
        }

      } catch (err) {
        console.error('Failed to fetch client data:', err);
        addToast(err.message || 'Failed to load client data', 'error', 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchAllClientData();
  }, [id]);

  // Keep fetch wrappers simple if any tab actions trigger manual re-fetches
  const fetchInvestments = async () => {
    setTabLoading(true);
    try {
      const res = await apiRequest(`/api/super-admin/clients/${clientProfileId}/investments`);
      const data = res.data || res;
      setInvestmentsData(data);
    } catch (err) {
      console.error('Failed to fetch investments:', err);
      setInvestmentsData({ investments: [] });
    } finally { setTabLoading(false); }
  };

  const fetchRoi = async () => {
    setTabLoading(true);
    try {
      const res = await apiRequest(`/api/super-admin/roi/payouts?status=All&recipientType=All`);
      const data = res.data || res;
      
      let extractedPayouts = [];
      if (Array.isArray(data)) {
        extractedPayouts = data;
      } else if (data.payouts && Array.isArray(data.payouts)) {
        extractedPayouts = data.payouts;
      } else if (data.list && Array.isArray(data.list)) {
        extractedPayouts = data.list;
      }

      const clientRoiHistory = extractedPayouts.filter(r => {
        const recId = r.recipientId || r.investorId || r.clientId || '';
        return String(recId) === String(clientProfileId) || String(recId) === String(id);
      }).map(r => ({
        _id: r.id || r._id,
        payoutMonth: r.month || r.period || '—',
        roiRate: r.roiPercentage ?? 0,
        amount: Number(r.amount || 0),
        status: r.status || 'pending',
        processedDate: r.paidAt || r.date || '—',
        ...r
      }));

      setRoiData({ roiHistory: clientRoiHistory });
    } catch (err) {
      console.error('Failed to fetch ROI:', err);
      setRoiData({ roiHistory: [], totalRoiPaid: 0, totalRoiPending: 0 });
    } finally { setTabLoading(false); }
  };

  const handleMarkPaid = async (roi) => {
    const pid = clientProfileId || id;
    const payoutId = roi._id || roi.id;
    if (!pid || !payoutId) return;

    try {
      setTabLoading(true);
      const isMockId = !/^[0-9a-fA-F]{24}$/.test(String(payoutId));

      let paidMockIds = [];
      try {
        const stored = localStorage.getItem('kfpl_super_admin_paid_mock_payouts');
        if (stored) paidMockIds = JSON.parse(stored);
      } catch (e) {}
      if (!paidMockIds.includes(String(payoutId))) {
        paidMockIds.push(String(payoutId));
        localStorage.setItem('kfpl_super_admin_paid_mock_payouts', JSON.stringify(paidMockIds));
      }

      if (!isMockId) {
        await apiRequest(`/api/super-admin/clients/${pid}/roi/${payoutId}/pay`, {
          method: 'PATCH'
        });
      } else {
        console.warn(`Simulating paid status for mock ROI payout ID: ${payoutId}`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      addToast(`ROI payout of ${formatCurrency(roi.amount || 0)} for ${roi.payoutMonth || roi.month} marked as paid successfully!`, 'success', 'ROI Paid');
      await fetchRoi();
    } catch (err) {
      console.error('Failed to mark ROI payout as paid:', err);
      addToast(err.message || 'Failed to update ROI status', 'error', 'Error');
      setTabLoading(false);
    }
  };

  const fetchPerks = async () => {
    setTabLoading(true);
    try {
      const res = await apiRequest(`/api/super-admin/clients/${clientProfileId}/perks`);
      const data = res.data || res;
      setPerksData(data);
    } catch (err) {
      console.error('Failed to fetch perks:', err);
      setPerksData({ perks: [] });
    } finally { setTabLoading(false); }
  };

  const fetchDocuments = async () => {
    setTabLoading(true);
    try {
      const res = await apiRequest(`/api/super-admin/clients/${clientProfileId}/documents`);
      const data = res.data || res;
      setDocsData(data);

      const docs = data.documents || [];
      const verifiedMap = {};
      docs.forEach(doc => {
        const label = doc.name || doc.label;
        const s = (doc.status || '').toLowerCase();
        if (s === 'verified' || s === 'approved' || doc.verified === true) {
          verifiedMap[label] = true;
        }
      });
      setVerifiedDocs(verifiedMap);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setDocsData({ documents: [] });
    } finally { setTabLoading(false); }
  };

  const handleConfirmRoiChange = async () => {
    const newRoi = parseFloat(roiInputVal);
    if (isNaN(newRoi) || newRoi < 0) {
      addToast('Please enter a valid ROI rate', 'error', 'Invalid Rate');
      return;
    }
    try {
      await apiRequest(`/api/super-admin/clients/${clientProfileId}/roi-rate`, {
        method: 'PATCH',
        body: JSON.stringify({ monthlyRoi: newRoi })
      });
      setLocalRoiPercentage(newRoi);
      setInvestor(prev => prev ? { ...prev, roiPercentage: newRoi } : prev);
      try {
        const cachedData = getSWRCache(`sa_client_detail_${id}`);
        if (cachedData && cachedData.investor) {
          cachedData.investor.roiPercentage = newRoi;
          setSWRCache(`sa_client_detail_${id}`, cachedData);
        }
        invalidateSWRCache(`sa_client_detail_${id}`);
      } catch (e) {}
      addToast(`Monthly ROI % updated to ${newRoi}%`, 'success', 'ROI Updated');
      setShowRoiEditModal(false);
      setRoiEditStep(1);
    } catch (err) {
      console.error('Failed to update ROI rate:', err);
      addToast(err.message || 'Failed to update ROI rate', 'error', 'Update Failed');
    }
  };

  // ── Loading state ────────────────────────────
  if (loading) {
    return (
      <div className="kfpl-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading client data...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="kfpl-page">
        <div className="kfpl-empty">
          <div className="kfpl-empty-title">Client not found</div>
          <button className="kfpl-btn kfpl-btn--primary mt-4" onClick={() => navigate('/investors')}>Back to List</button>
        </div>
      </div>
    );
  }

  const tabs = ['profile', 'investments', 'roi', 'perks', 'documents'];

  // ROI tab calculations (from API data)
  const getRoiHistoryList = (data) => {
    if (!data) return [];
    let list = [];
    if (Array.isArray(data)) list = data;
    else if (data.roiHistory && Array.isArray(data.roiHistory)) list = data.roiHistory;
    else if (data.payouts && Array.isArray(data.payouts)) list = data.payouts;
    else if (data.list && Array.isArray(data.list)) list = data.list;
    else if (data.data) {
      if (Array.isArray(data.data)) list = data.data;
      else if (data.data.roiHistory && Array.isArray(data.data.roiHistory)) list = data.data.roiHistory;
      else if (data.data.payouts && Array.isArray(data.data.payouts)) list = data.data.payouts;
      else if (data.data.list && Array.isArray(data.data.list)) list = data.data.list;
    }
    return list;
  };

  const roiHistory = getRoiHistoryList(roiData).map(r => {
    const rawRate = r.roiRate || r.roiPercentage || r.rate || localRoiPercentage || 0;
    const cleanRate = String(rawRate).replace('%', '').trim();
    const displayRate = cleanRate && cleanRate !== '0' ? `${cleanRate}%` : `${localRoiPercentage || 0}%`;
    return {
      ...r,
      _id: r.id || r._id,
      payoutMonth: r.payoutMonth || r.month || r.period || 'Aug 2026',
      roiRate: displayRate,
      amount: Number(r.amount || 0),
      status: (r.status || 'PENDING').toUpperCase(),
      processedDate: r.processedDate || r.paidAt || r.date || '—',
    };
  });
  const totalPaidROI = roiHistory.filter(r => (r.status || '').toLowerCase() === 'paid').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalPendingROI = roiHistory.filter(r => (r.status || '').toLowerCase() === 'pending').reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // Investments from API (only allocated investments)
  const investmentsList = investmentsData?.investments || [];
  const resolvedInvestments = investmentsList.filter(inv => inv.segment && inv.segment !== 'Unallocated');

  // Perks from API
  const perksList = perksData?.perks || [];

  // Documents from API
  const documentsList = docsData?.documents || [];
  const allDocsVerified = documentsList.length > 0 && documentsList.every(doc => !!verifiedDocs[doc.name || doc.label]);

  const riskMap = {
    conservative: 'conservative',
    moderate: 'moderate',
    aggressive: 'aggressive'
  };

  const handleRiskProfileChange = async (e) => {
    const newRisk = e.target.value;
    try {
      await apiRequest(`/api/super-admin/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ riskProfile: newRisk })
      });
      setLocalRiskProfile(newRisk);
      addToast(`Risk profile updated to ${newRisk}`, 'success', 'Profile Updated');
    } catch (err) {
      console.error('Failed to update risk profile:', err);
      addToast(err.message || 'Failed to update risk profile', 'error', 'Update Failed');
    }
  };

  const handleBlockClient = async () => {
    const newStatus = localStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await apiRequest(`/api/super-admin/client-portal/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setLocalStatus(newStatus);
      addToast(`Client status set to ${newStatus.toUpperCase()}`, 'info', 'Status Changed');
    } catch (err) {
      console.error('Failed to toggle block status:', err);
      addToast(err.message || 'Failed to change portal status', 'error', 'Status Change Failed');
    }
  };

  const handleHoldClient = async () => {
    const newStatus = localStatus === 'inactive' ? 'active' : 'inactive';
    try {
      await apiRequest(`/api/super-admin/client-portal/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setLocalStatus(newStatus);
      addToast(`Client status set to ${newStatus.toUpperCase()}`, 'info', 'Status Changed');
    } catch (err) {
      console.error('Failed to toggle hold status:', err);
      addToast(err.message || 'Failed to change portal status', 'error', 'Status Change Failed');
    }
  };

  const handleDeleteClient = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await apiRequest(`/api/super-admin/clients/${id}`, {
        method: 'DELETE'
      });
      addToast('Client profile deleted successfully!', 'success', 'Client Deleted');
      setShowDeleteModal(false);
      navigate('/investors');
    } catch (err) {
      console.error('Failed to delete client:', err);
      addToast(err.message || 'Failed to delete client', 'error', 'Deletion Failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVerifyDocument = async (docLabel) => {
    let fieldName = 'panDocument';
    const label = docLabel.toLowerCase();
    if (label.includes('nominee')) {
      fieldName = 'nomineeProofDocument';
    } else if (label.includes('pan')) {
      fieldName = 'panDocument';
    } else if (label.includes('aadhaar') || label.includes('id proof')) {
      fieldName = 'aadhaarDocument';
    } else if (label.includes('bank') || label.includes('details')) {
      fieldName = 'bankProofDocument';
    } else if (label.includes('agreement')) {
      fieldName = 'agreementDocument';
    }

    try {
      await apiRequest(`/api/super-admin/clients/${clientProfileId}/verify-document`, {
        method: 'PATCH',
        body: JSON.stringify({
          documentName: docLabel,
          documentField: fieldName,
          field: fieldName,
          fieldName: fieldName,
          docField: fieldName,
          status: 'Verified'
        })
      });

      const newVerified = { ...verifiedDocs, [docLabel]: true };
      setVerifiedDocs(newVerified);
      if (docsData && docsData.documents) {
        const updatedDocs = docsData.documents.map(d => {
          if ((d.name || d.label) === docLabel) {
            return { ...d, status: 'Verified' };
          }
          return d;
        });
        setDocsData({ ...docsData, documents: updatedDocs });

        // Auto-verify KYC when ALL documents are verified
        const allNowVerified = updatedDocs.length > 0 && updatedDocs.every(d => {
          const label = d.name || d.label;
          return newVerified[label] || d.status === 'Verified';
        });
        if (allNowVerified) {
          await handleKycStatusChange('VERIFIED');
          addToast('All documents verified — KYC automatically set to Verified!', 'success', 'KYC Auto-Verified');
        }
      }
      addToast(`"${docLabel}" verified successfully!`, 'success', 'Document Verified');
      await fetchDocuments(); // Refresh from backend to sync
    } catch (err) {
      console.error('Failed to verify document:', err);
      addToast(err.message || 'Failed to verify document', 'error', 'Verification Failed');
    }
  };

  const handleKycStatusChange = async (newKycStatus) => {
    try {
      await apiRequest(`/api/super-admin/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          kycStatus: newKycStatus,
          kyc: newKycStatus
        })
      });
      setInvestor(prev => prev ? { ...prev, kyc: newKycStatus } : null);
    } catch (err) {
      console.error('Failed to update KYC status:', err);
      addToast(err.message || 'Failed to update KYC status', 'error', 'Update Failed');
    }
  };

  const normalizeUrl = (url) => {
    if (!url) return '';
    let normalized = url;
    if (
      normalized.startsWith('uploads/') ||
      normalized.startsWith('/uploads/') ||
      (!normalized.startsWith('http://') &&
        !normalized.startsWith('https://') &&
        !normalized.startsWith('blob:') &&
        !normalized.startsWith('data:'))
    ) {
      const base = getApiUrl('');
      const cleanPath = normalized.startsWith('/') ? normalized : '/' + normalized;
      normalized = base + cleanPath;
    }
    if (normalized.startsWith('http://')) {
      const isLocal = normalized.includes('localhost') || normalized.includes('192.168.');
      if (!isLocal) {
        normalized = 'https://' + normalized.substring(7);
      }
    }
    return normalized;
  };

  const getFileType = (url, filename) => {
    if (!url) return 'none';
    const targetUrl = normalizeUrl(url);
    const labelLower = (filename || targetUrl || '').toLowerCase();
    
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].some(ext => labelLower.includes('.' + ext)) || /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(targetUrl);
    if (isImage) return 'image';
    const isPdf = labelLower.includes('.pdf') || /\.pdf/i.test(targetUrl);
    if (isPdf) return 'pdf';
    const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].some(ext => labelLower.includes('.' + ext)) || /\.(doc|docx|xls|xlsx|ppt|pptx)/i.test(targetUrl) || labelLower.includes('agreement') || targetUrl.includes('/agreements/');
    if (isOffice) return 'office';
    return 'office';
  };

  const downloadFile = async (url, filename) => {
    if (!url) {
      addToast('No file URL available', 'error', 'Download Failed');
      return;
    }
    const targetUrl = normalizeUrl(url);
    const isCloudinary = targetUrl.includes('cloudinary.com') || targetUrl.includes('res.cloudinary.com');

    if (isCloudinary) {
      addToast('Starting file download...', 'info', 'Downloading');
      try {
        const link = document.createElement('a');
        link.href = targetUrl;
        link.setAttribute('download', filename || 'document');
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('File download started!', 'success', 'Downloaded');
      } catch (err) {
        window.open(targetUrl, '_blank');
        addToast('File opened in new tab', 'success', 'Opened');
      }
      return;
    }

    addToast('Starting secure file download...', 'info', 'Downloading');
    try {
      const token = getAuthToken();

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(targetUrl, { headers });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      addToast('File downloaded successfully!', 'success', 'Downloaded');
    } catch (error) {
      console.error('Fetch download error, falling back to window.open:', error);
      window.open(targetUrl, '_blank');
      addToast('File opened in new tab', 'success', 'Opened');
    }
  };

  return (
    <div className="kfpl-page">
      {/* Premium Gradient Header Card */}
      <div className="kfpl-detail-card-header">
        <div className="kfpl-detail-profile">
          <div className="kfpl-detail-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {investor.profilePic ? (
              <img src={investor.profilePic} alt={investor.name} style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
            ) : (
              investor.name.split(' ').map(n => n[0]).join('')
            )}
          </div>
          <div>
            <h2 className="kfpl-detail-name" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{investor.name}</h2>
            <div className="kfpl-detail-id" style={{ marginTop: '2px' }}>ID: {investor.clientId}</div>
            <div className="kfpl-detail-meta" style={{ marginTop: '8px' }}>
              <Badge status={investor.category}>{investor.category} Tier</Badge>
              <Badge status={localStatus}>{localStatus}</Badge>
              <Badge status={riskMap[String(localRiskProfile || '').toLowerCase()] || 'conservative'}>{localRiskProfile} Risk</Badge>
            </div>
          </div>
        </div>
        <div className="kfpl-detail-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: 'var(--color-white)', borderColor: 'rgba(255, 255, 255, 0.25)', background: 'rgba(255, 255, 255, 0.05)' }} onClick={() => navigate('/investors')}>
            ← Back
          </button>
          {canEdit('manageClients') && (
            <>
              <button type="button" className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: 'var(--color-white)', borderColor: 'rgba(255, 255, 255, 0.25)', background: localStatus === 'suspended' ? '#EF4444' : 'rgba(255, 255, 255, 0.05)' }} onClick={handleBlockClient}>
                {localStatus === 'suspended' ? 'Unblock Client' : 'Block Client'}
              </button>
              <button type="button" className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: 'var(--color-white)', borderColor: 'rgba(255, 255, 255, 0.25)', background: localStatus === 'inactive' ? '#F59E0B' : 'rgba(255, 255, 255, 0.05)' }} onClick={handleHoldClient}>
                {localStatus === 'inactive' ? 'Resume Client' : 'Hold Client'}
              </button>
            </>
          )}
          {canDelete('manageClients') && (
            <button type="button" className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: '#EF4444', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.05)' }} onClick={() => setShowDeleteModal(true)}>
              Delete Client
            </button>
          )}
          {canEdit('manageClients') && (
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" style={{ background: '#10B981', color: 'var(--color-white)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }} onClick={() => navigate(`/investors/${id}/edit`)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* KPI summaries dashboard */}
      <div className="kfpl-detail-kpis-summary">
        <div className="kfpl-detail-kpi-summary-card">
          <span className="kfpl-detail-kpi-summary-label">Total Investment</span>
          <span className="kfpl-detail-kpi-summary-value" style={{ color: '#10B981' }}>{formatCurrency(investor.totalInvestment)}</span>
        </div>
        <div className="kfpl-detail-kpi-summary-card">
          <span className="kfpl-detail-kpi-summary-label">Active Segments</span>
          <span className="kfpl-detail-kpi-summary-value">
            {(() => {
              const list = (investmentsList && investmentsList.length > 0)
                ? investmentsList.filter(i => (i.status || '').toUpperCase() === 'ACTIVE')
                : [];
              const allocated = list.filter(i => {
                const seg = String(i.segment || i.projectName || i.name || '').toLowerCase().trim();
                return seg && seg !== 'unallocated' && seg !== 'unallocated segment' && seg !== 'none' && seg !== '—' && seg !== '-';
              });
              const uniqueSegs = new Set(allocated.map(i => String(i.segment || i.projectName || i.name).toLowerCase().trim()));
              const count = investor.activeSegments !== undefined ? investor.activeSegments : uniqueSegs.size;
              return `${count} ${count === 1 ? 'Segment' : 'Segments'}`;
            })()}
          </span>
        </div>
        <div className="kfpl-detail-kpi-summary-card">
          <span className="kfpl-detail-kpi-summary-label">Monthly ROI %</span>
          <span className="kfpl-detail-kpi-summary-value" style={{ color: '#F59E0B' }}>{localRoiPercentage}% Monthly</span>
        </div>
        <div className="kfpl-detail-kpi-summary-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span className="kfpl-detail-kpi-summary-label">KYC Verification</span>
          <div style={{ marginTop: '4px' }}>
            {investor.kyc === 'VERIFIED' ? (
              <Badge status="active">Verified</Badge>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <select
                  className="kfpl-select"
                  value={investor.kyc || 'PENDING'}
                  onChange={(e) => handleKycStatusChange(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '4px 8px', 
                    fontSize: '0.85rem', 
                    borderRadius: '6px', 
                    border: '1px solid #10B981', 
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Verified</option>
                </select>
                {!allDocsVerified && (
                  <span style={{ fontSize: '0.68rem', color: '#EF4444', fontWeight: 500 }}>
                    ⚠️ Verify all docs first
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Segmented Pill Tab Bar */}
      <div className="kfpl-tabs">
        {tabs.map(tab => (
          <div
            key={tab}
            className={`kfpl-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tabIcons[tab]}
            {tab.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="kfpl-detail-grid">
          <div className="kfpl-detail-info-card">
            <div className="kfpl-detail-info-title">Personal Information</div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.user}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Full Name</span>
                <span className="kfpl-detail-info-item-value">{investor.name}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.mail}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Email Address</span>
                <span className="kfpl-detail-info-item-value">{investor.email}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.phone}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Phone Number</span>
                <span className="kfpl-detail-info-item-value">{investor.phone}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.calendar}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Date of Birth <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(DD/MM/YYYY)</span></span>
                <span className="kfpl-detail-info-item-value">{investor.dob}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.mapPin}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Address</span>
                <span className="kfpl-detail-info-item-value">{investor.address}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.calendar}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Join Date <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(DD/MM/YYYY)</span></span>
                <span className="kfpl-detail-info-item-value">{investor.joinDate}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.calendar}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Contract Start Date <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(DD/MM/YYYY)</span></span>
                <span className="kfpl-detail-info-item-value">{investor.contractStartDate}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.calendar}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Contract End Date <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(DD/MM/YYYY)</span></span>
                <span className="kfpl-detail-info-item-value">{investor.contractEndDate}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.calendar}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Contract Extended Date <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(DD/MM/YYYY)</span></span>
                <span className="kfpl-detail-info-item-value">{investor.extendContractDate}</span>
              </div>
            </div>
          </div>

          <div className="kfpl-detail-info-card">
            <div className="kfpl-detail-info-title">KYC & Financial Information</div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.shield}</div>
              <div className="kfpl-detail-info-item-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <span className="kfpl-detail-info-item-label">KYC Status</span>
                  <span className="kfpl-detail-info-item-value" style={{ display: 'block', marginTop: '2px' }}>
                    {investor.kyc === 'VERIFIED' ? (
                      <Badge status="active">Verified</Badge>
                    ) : (
                      <Badge status="pending">Pending</Badge>
                    )}
                  </span>
                </div>
                {investor.kyc === 'VERIFIED' ? null : allDocsVerified ? (
                  <select
                    className="kfpl-select"
                    value={investor.kyc || 'PENDING'}
                    onChange={(e) => handleKycStatusChange(e.target.value)}
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '0.8rem', 
                      borderRadius: '6px', 
                      border: '1px solid #10B981', 
                      background: '#FEF3C7',
                      color: '#92400E',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 500 }}>
                    ⚠️ Verify all docs first
                  </span>
                )}
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="kfpl-detail-info-item-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <span className="kfpl-detail-info-item-label">Risk Profile</span>
                  <span className="kfpl-detail-info-item-value">{localRiskProfile}</span>
                </div>
                <select
                  value={localRiskProfile}
                  onChange={handleRiskProfileChange}
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Aggressive">Aggressive</option>
                </select>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Monthly ROI Rate</span>
                <span className="kfpl-detail-info-item-value" style={{ color: '#10B981', fontWeight: 800 }}>{localRoiPercentage}% Monthly</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.globe}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Residency Status</span>
                <span className="kfpl-detail-info-item-value">{investor.residencyStatus}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.fileText}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">
                  {investor.residencyStatus === 'International' ? 'Tax ID / SSN Number' : 'PAN Card Number'}
                </span>
                <span className="kfpl-detail-info-item-value">
                  <SensitiveValueToggle value={investor.pan} maskLength={4} />
                </span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.fileText}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">
                  {investor.residencyStatus === 'International' ? 'Passport / National ID Number' : 'Aadhaar Number'}
                </span>
                <span className="kfpl-detail-info-item-value">
                  <SensitiveValueToggle value={investor.aadhaar} maskLength={4} />
                </span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.landmark}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Bank Name</span>
                <span className="kfpl-detail-info-item-value">{investor.bankName}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.fileText}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Account No.</span>
                <span className="kfpl-detail-info-item-value">
                  <SensitiveValueToggle value={investor.accountNo} maskLength={4} />
                </span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.shield}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">
                  {investor.residencyStatus === 'International' ? 'IFSC / SWIFT Code' : 'IFSC Code'}
                </span>
                <span className="kfpl-detail-info-item-value">
                  <SensitiveValueToggle value={investor.ifsc} maskLength={4} />
                </span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>{infoIcons.wallet}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Total Portfolio Value</span>
                <span className="kfpl-detail-info-item-value" style={{ color: '#10B981', fontWeight: 800 }}>{formatCurrency(investor.totalInvestment)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'investments' && (
        <div className="kfpl-table-container">
          <div className="kfpl-table-toolbar">
            <h3 className="kfpl-form-card-title" style={{ margin: 0 }}>Active Segment Distribution</h3>
          </div>
          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Amount</th>
                  <th>ROI Rate</th>
                  <th>Risk Level</th>
                  <th>Allocation Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tabLoading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>Loading investments...</td></tr>
                ) : resolvedInvestments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>No Project Allocated Yet</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted, #94a3b8)' }}>Super Admin has not assigned any active project/segment allocation to this client.</span>
                      </div>
                    </td>
                  </tr>
                ) : resolvedInvestments.map(inv => {
                  const isUnallocated = !inv.segment || inv.segment === 'Project Allocated' || inv.segment === 'General Capital Pool' || inv.segment === 'Capital Deposit' || inv.segment === 'Unallocated Pool';
                  const segText = isUnallocated ? 'Unallocated' : inv.segment;
                  return (
                    <tr key={inv._id || inv.id}>
                      <td className="kfpl-table-cell-primary">{segText}</td>
                    <td className="font-semibold" style={{ color: '#10B981' }}>{formatCurrency(inv.investmentAmount || inv.amount || 0)}</td>
                    <td>{inv.roiPercentage || inv.roi || localRoiPercentage}%</td>
                    <td>
                      <Badge status={inv.riskPercentage > 50 ? 'rejected' : inv.riskPercentage > 25 ? 'pending' : 'active'}>
                        {inv.riskPercentage > 50 ? 'High' : inv.riskPercentage > 25 ? 'Medium' : 'Low'}
                      </Badge>
                    </td>
                    <td>{inv.allocationDate ? new Date(inv.allocationDate).toLocaleDateString('en-IN') : inv.investmentDate ? new Date(inv.investmentDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td><Badge status={(inv.status || 'active').toLowerCase()}>{inv.status || 'Active'}</Badge></td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="kfpl-table-container">
            <div className="kfpl-table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>ROI Payout Statements</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Export CSV or print PDF statements for client's ROI returns</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                  onClick={() => {
                    setRoiInputVal(String(localRoiPercentage));
                    setRoiEditStep(1);
                    setShowRoiEditModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit ROI Rate
                </button>
                <button
                  className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                  onClick={() => {
                    downloadAllClientROICSV(roiHistory, investor);
                    addToast('All CSV statements downloaded', 'success', 'Download Complete');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  CSV (All)
                </button>
                <button
                  className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                  onClick={() => {
                    downloadAllClientROIPDF(roiHistory, investor);
                    addToast('All PDF statements generated', 'success', 'Download Complete');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  PDF (All)
                </button>
              </div>
            </div>

            <div className="kfpl-table-scroll">
              <table className="kfpl-table">
                <thead>
                  <tr>
                    <th>Payout Month</th>
                    <th>ROI Rate</th>
                    <th>Payout Amount</th>
                    <th>Payout Status</th>
                    <th>Processed Date</th>
                    <th style={{ textAlign: 'center' }}>Download Statement</th>
                  </tr>
                </thead>
                <tbody>
                  {tabLoading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>Loading ROI data...</td></tr>
                  ) : roiHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                        No ROI payout records found for this client.
                      </td>
                    </tr>
                  ) : (
                    roiHistory.map(roi => (
                      <tr key={roi._id || roi.id}>
                        <td className="kfpl-table-cell-primary">{roi.payoutMonth || roi.month}</td>
                        <td><strong>{String(roi.roiRate || roi.roiPercentage || localRoiPercentage || 0).replace('%', '')}%</strong></td>
                        <td className="font-semibold">{formatCurrency(roi.amount || 0)}</td>
                        <td>
                          {(() => {
                            const statusStr = String(roi.status || 'PENDING').toUpperCase();
                            const isPaid = statusStr === 'PAID' || statusStr === 'APPROVED';
                            return (
                              <Badge status={isPaid ? 'approved' : 'pending'}>
                                {isPaid ? 'APPROVED' : 'PENDING'}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td>
                          {(() => {
                            const statusStr = String(roi.status || 'PENDING').toUpperCase();
                            const isPaid = statusStr === 'PAID' || statusStr === 'APPROVED';
                            const rawDate = roi.processedDate || roi.paidAt;
                            if (isPaid && rawDate && rawDate !== '—' && rawDate !== '-') {
                              try {
                                const d = new Date(rawDate);
                                if (!isNaN(d.getTime())) return d.toLocaleDateString('en-IN');
                              } catch (e) {}
                              return rawDate;
                            }
                            return '—';
                          })()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                              onClick={() => {
                                downloadClientROISingleCSV({...roi, month: roi.payoutMonth || roi.month}, { ...investor, investments: resolvedInvestments });
                                addToast(`Statement CSV downloaded for ${roi.payoutMonth || roi.month}`, 'success', 'Downloaded');
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 8px' }}
                              title="Download CSV"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="12" height="12">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                              </svg>
                              CSV
                            </button>
                            <button
                              className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                              onClick={() => {
                                downloadClientROISinglePDF({...roi, month: roi.payoutMonth || roi.month}, { ...investor, investments: resolvedInvestments });
                                addToast(`Statement PDF generated for ${roi.payoutMonth || roi.month}`, 'success', 'Downloaded');
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 8px' }}
                              title="Download PDF"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="12" height="12">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                              </svg>
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'perks' && (() => {
        const perksList = (() => {
          if (!perksData) return [];
          if (Array.isArray(perksData)) return perksData;
          if (perksData.perks && Array.isArray(perksData.perks)) return perksData.perks;
          if (perksData.data?.perks && Array.isArray(perksData.data.perks)) return perksData.data.perks;
          return [];
        })();

        const tierStyles = {
          silver: { bg: 'rgba(156, 163, 175, 0.12)', color: '#6B7280', border: '#D1D5DB' },
          gold: { bg: 'rgba(245, 158, 11, 0.1)', color: '#D97706', border: '#FCD34D' },
          platinum: { bg: 'rgba(75, 85, 99, 0.1)', color: '#4B5563', border: '#CBD5E1' },
          diamond: { bg: 'rgba(6, 182, 212, 0.1)', color: '#0891B2', border: '#A5F3FC' },
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="kfpl-page-header" style={{ marginBottom: '4px' }}>
              <div>
                <h3 className="kfpl-form-card-title" style={{ margin: 0 }}>Assigned Loyalty Perks</h3>
                <p className="kfpl-page-subtitle" style={{ margin: '2px 0 0 0' }}>Client benefits based on their {investor?.category || 'current'} recognition tier</p>
              </div>
            </div>

            {tabLoading ? (
              <div className="kfpl-detail-info-card"><div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>Loading perks...</div></div>
            ) : perksList.length === 0 ? (
              <div className="kfpl-detail-info-card">
                <div className="kfpl-empty" style={{ padding: '40px' }}>
                  <div className="kfpl-empty-title">No perks assigned</div>
                  <div className="kfpl-empty-text">Upgrade client recognition tier or assign custom perks.</div>
                </div>
              </div>
            ) : (
              <div className="kfpl-perks-grid">
                {perksList.map((perk, i) => {
                  const perkName = typeof perk === 'string' ? perk : (perk.title || perk.name || '');
                  const perkDesc = typeof perk === 'object' ? (perk.description || '') : '';
                  const perkBadge = (typeof perk === 'object' && perk.tier ? perk.tier : (investor?.category || 'silver')).toLowerCase();
                  const styleConfig = tierStyles[perkBadge] || tierStyles.silver;
                  return (
                    <div key={i} className="kfpl-perk-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div className="kfpl-perk-tier-stripe" style={{ background: styleConfig.color }} />
                      <div className="kfpl-perk-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
                        <div className="kfpl-perk-icon-wrap" style={{ background: styleConfig.bg, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', color: styleConfig.color }}>
                            <polyline points="20 12 20 22 4 22 4 12"></polyline>
                            <rect x="2" y="7" width="20" height="5"></rect>
                            <line x1="12" y1="22" x2="12" y2="7"></line>
                            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                          </svg>
                        </div>
                        <Badge status={perkBadge}>{perkBadge}</Badge>
                      </div>
                      <div className="kfpl-perk-card-body" style={{ flex: 1, padding: '16px 20px' }}>
                        <h4 className="kfpl-perk-card-title" style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>{perkName}</h4>
                        <div className="kfpl-perk-card-desc">
                          {renderFormattedDescription(perkDesc)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="kfpl-page-header" style={{ marginBottom: '4px' }}>
            <div>
              <h3 className="kfpl-form-card-title" style={{ margin: 0 }}>Onboarded Documents</h3>
              <p className="kfpl-page-subtitle" style={{ margin: '2px 0 0 0' }}>KYC, financial verification, agreement, and nominee documents</p>
            </div>
          </div>

          <div className="kfpl-detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {tabLoading ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>Loading documents...</div>
            ) : documentsList.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>No documents found.</div>
            ) : documentsList.map((doc, idx) => {
              const docName = doc.name || doc.label;
              const isVerified = !!verifiedDocs[docName];
              return (
                <div key={idx} className="kfpl-detail-info-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px', minHeight: '160px', position: 'relative' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ background: 'var(--color-gold-glow, #fef3c7)', color: 'var(--color-gold-dark, #b38600)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="20" height="20">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{docName}</h4>
                          {isVerified && <Badge status="active">Verified</Badge>}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{doc.fileName || 'PDF Document'} • {doc.fileSize || '—'}</span>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {doc.description || doc.desc || 'Uploaded document'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '12px' }}>
                    <button 
                      className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" 
                      style={{ flex: 1, fontSize: '0.78rem', padding: '6px 0' }}
                      onClick={() => setViewingDoc({ label: docName, filename: doc.fileName || 'document.pdf', investorName: doc.holder || investor.name, status: isVerified ? 'Verified' : 'Pending Verification', uploadedAt: doc.uploadedDate || doc.uploaded || investor.joinDate, url: doc.url })}
                    >
                      View Document
                    </button>
                    {!isVerified && (
                      <button 
                        className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" 
                        style={{ fontSize: '0.78rem', padding: '6px 12px', fontWeight: '700' }}
                        onClick={() => handleVerifyDocument(docName)}
                      >
                        Verify
                      </button>
                    )}
                    <button 
                      className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" 
                      style={{ padding: '6px 10px' }}
                      onClick={() => downloadFile(doc.url, docName)}
                      title="Download File"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="14" height="14">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Document Viewer Modal ─── */}
      {viewingDoc && createPortal(
        <div
          className="kfpl-modal-overlay"
          onClick={() => setViewingDoc(null)}
        >
          <div
            className="kfpl-modal"
            style={{ maxWidth: '640px', width: '95%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="kfpl-modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
              <h3 className="kfpl-modal-title" style={{ color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>{viewingDoc.label}</h3>
              <button className="kfpl-modal-close" onClick={() => setViewingDoc(null)} aria-label="Close modal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: '#64748b', width: '16px', height: '16px' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="kfpl-modal-body" style={{ background: '#f8fafc', padding: 0, display: 'flex', flexDirection: 'column' }}>
              {/* File Preview Area */}
              {previewLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#64748b', minHeight: '260px' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: '0.8rem', marginTop: '12px', fontWeight: 500 }}>Loading secure document preview...</span>
                </div>
              ) : previewUrl ? (
                (() => {
                  const fileUrl = previewUrl;
                  const fileType = getFileType(viewingDoc.url, viewingDoc.filename);
                  if (fileType === 'image') {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#f8fafc', minHeight: '260px' }}>
                        <img src={fileUrl} alt={viewingDoc.label} style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                      </div>
                    );
                  } else if (fileType === 'pdf') {
                    return <iframe src={fileUrl} title={viewingDoc.label} style={{ width: '100%', height: '450px', border: 'none', background: '#ffffff' }} />;
                  } else if (fileType === 'office' || fileType === 'other') {
                    const isBlob = fileUrl.startsWith('blob:') || fileUrl.startsWith('data:');
                    if (isBlob) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#f8fafc', minHeight: '260px', color: '#64748b' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ marginBottom: '12px', opacity: 0.6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                          <p style={{ margin: 0, fontSize: '0.8rem' }}>Local document. Click "Download Original" to view.</p>
                        </div>
                      );
                    }
                    const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
                    return (
                      <div style={{ width: '100%', height: '450px', position: 'relative' }}>
                        <iframe src={viewerUrl} title={viewingDoc.label} style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff' }} />
                      </div>
                    );
                  }
                })()
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#f8fafc', minHeight: '260px', color: '#64748b' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ marginBottom: '12px', opacity: 0.6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>No file available</p>
                </div>
              )}

              {/* Document Info Bar */}
              <div style={{ background: '#ffffff', padding: '14px 20px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{viewingDoc.filename}</h4>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Uploaded: {viewingDoc.uploadedAt}</span>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                    background: verifiedDocs[viewingDoc.label] ? '#dcfce7' : '#fef3c7',
                    color: verifiedDocs[viewingDoc.label] ? '#16a34a' : '#d97706',
                    border: `1px solid ${verifiedDocs[viewingDoc.label] ? '#bbf7d0' : '#fde68a'}`
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: verifiedDocs[viewingDoc.label] ? '#16a34a' : '#d97706' }} />
                    {verifiedDocs[viewingDoc.label] ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: '#64748b' }}>
                  <span><strong style={{ color: '#1e293b' }}>Holder:</strong> {viewingDoc.investorName}</span>
                </div>
              </div>
            </div>
            <div className="kfpl-modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                onClick={() => setViewingDoc(null)}
              >Close</button>
              {!verifiedDocs[viewingDoc.label] && (
                <button
                  type="button"
                  className="kfpl-btn kfpl-btn--sm"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)', borderColor: 'transparent', color: '#FFFFFF', fontWeight: 700, padding: '6px 16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(16,185,129,0.3)', fontSize: '0.8rem' }}
                  onClick={() => {
                    handleVerifyDocument(viewingDoc.label);
                    setViewingDoc(null);
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                    Verify Document
                  </span>
                </button>
              )}
              <button
                type="button"
                className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                style={{ fontWeight: 700, padding: '6px 16px', borderRadius: '8px', fontSize: '0.8rem' }}
                onClick={() => {
                  downloadFile(viewingDoc.url, viewingDoc.filename);
                  setViewingDoc(null);
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Original
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit ROI Modal Wizard */}
      <Modal
        isOpen={showRoiEditModal}
        onClose={() => {
          setShowRoiEditModal(false);
          setRoiEditStep(1);
        }}
        title={roiEditStep === 1 ? "Confirm Rate Adjustment" : "Edit Monthly ROI Rate"}
        footer={
          roiEditStep === 1 ? (
            <>
              <button 
                className="kfpl-btn kfpl-btn--ghost" 
                onClick={() => setShowRoiEditModal(false)}
              >
                Cancel
              </button>
              <button 
                className="kfpl-btn kfpl-btn--primary" 
                onClick={() => setRoiEditStep(2)}
              >
                Yes, Proceed
              </button>
            </>
          ) : (
            <>
              <button 
                className="kfpl-btn kfpl-btn--ghost" 
                onClick={() => setRoiEditStep(1)}
              >
                Back
              </button>
              <button 
                className="kfpl-btn kfpl-btn--primary" 
                onClick={handleConfirmRoiChange}
              >
                Confirm Rate
              </button>
            </>
          )
        }
      >
        {roiEditStep === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: '1.4' }}>
                Are you sure you want to adjust the Monthly ROI rate for <strong>{investor.name}</strong>? 
                This will update their profile and affect all subsequent monthly ROI payouts.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Specify the new Monthly ROI Rate (% p.m.) for <strong>{investor.name}</strong> below:
            </p>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Monthly ROI Percentage (% p.m.) <span className="required">*</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="kfpl-input"
                  value={roiInputVal}
                  onChange={(e) => setRoiInputVal(e.target.value)}
                  placeholder="e.g. 1.5"
                  style={{ flex: 1 }}
                  required
                />
                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>% p.m.</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Custom Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Client Deletion"
        footer={
          <>
            <button 
              className="kfpl-btn kfpl-btn--ghost" 
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteLoading}
            >
              Cancel
            </button>
            <button 
              className="kfpl-btn" 
              style={{ background: '#EF4444', borderColor: 'transparent', color: '#FFFFFF', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Yes, Delete Client'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px' }}>
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            alignItems: 'flex-start', 
            background: 'rgba(239, 68, 68, 0.05)', 
            border: '1px solid rgba(239, 68, 68, 0.15)', 
            padding: '16px', 
            borderRadius: '12px' 
          }}>
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: '#EF4444', 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              flexShrink: 0,
              fontSize: '1.25rem',
              fontWeight: 'bold'
            }}>
              ⚠️
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                Permanently delete client profile?
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4B5563', lineHeight: '1.5' }}>
                Are you sure you want to completely remove <strong>{investor.name}</strong> from the database? 
                This action is irreversible and will delete all associated profiles, credentials, investments, statements, and documents.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============ END: InvestorDetail.jsx ============ */
