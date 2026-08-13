/* ============================================================
   Page: NewsMediaList.jsx
   Description: News & Media management list with search, filter, and CRUD
   ============================================================ */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NEWS_CATEGORIES } from '../../data/mockData';
import { apiRequest } from '../../config/apiHelper';

const extractArticles = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (res.data) {
    if (Array.isArray(res.data)) return res.data;
    if (res.data.articles && Array.isArray(res.data.articles)) return res.data.articles;
  }
  if (res.articles && Array.isArray(res.articles)) return res.articles;
  return [];
};

export default function NewsMediaList() {
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sentNotification, setSentNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
    try {
      const stored = localStorage.getItem('kfpl_email_notifications_sent');
      if (stored) {
        setSentNotification(JSON.parse(stored));
        localStorage.removeItem('kfpl_email_notifications_sent');
      }
    } catch (e) {
      console.warn('Failed to parse email notifications log', e);
    }
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/super-admin/articles');
      const raw = extractArticles(data);
      const mapped = raw.map(a => ({
        id: a._id || a.id,
        title: a.title || '',
        excerpt: a.excerpt || '',
        content: a.content || '',
        category: a.category || 'Company News',
        author: a.author || 'KFPL Communications',
        date: a.publishDate || a.date || new Date().toISOString(),
        status: a.status || 'Draft',
        imageUrl: a.imageUrl || a.featuredImage || '',
        quote: a.specialQuote || a.quote || '',
        quoteAuthor: a.quoteAuthorRole || a.quoteAuthor || '',
        advisory: a.advisoryNotice || a.advisory || '',
      }));
      setArticles(mapped);
    } catch (e) {
      console.error('Failed to load articles', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      await apiRequest(`/api/super-admin/articles/${id}`, {
        method: 'DELETE'
      });
      setArticles(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error('Failed to delete article', e);
      alert(`Failed to delete article: ${e.message}`);
    }
  };

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.author.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'All' || a.category === filterCategory;
    const matchStatus = filterStatus === 'All' || a.status === filterStatus;
    return matchSearch && matchCategory && matchStatus;
  });

  const publishedCount = articles.filter(a => a.status === 'Published').length;
  const draftCount = articles.filter(a => a.status === 'Draft').length;

  return (
    <div className="kfpl-page">
      {sentNotification && (
        <div className="kfpl-alert kfpl-alert--success" style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px', background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <div>
            <strong style={{ fontSize: '0.875rem' }}>Simulated Email Notifications Dispatched!</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: '#047857', lineHeight: '1.4' }}>
              Successfully sent email notification alerts to <strong>{sentNotification.count}</strong> subscriber(s) for the new article: <em>"{sentNotification.title}"</em>.
            </p>
          </div>
        </div>
      )}
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h1 className="kfpl-page-title">News & Media</h1>
          <p className="kfpl-page-subtitle">Manage articles, press releases, and company updates</p>
        </div>
        <div className="kfpl-page-header-actions">
          <Link to="/news-media/add" className="kfpl-btn kfpl-btn--primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Article
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="kfpl-nm-stats">
        <div className="kfpl-nm-stat-card">
          <div className="kfpl-nm-stat-icon total">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <div className="kfpl-nm-stat-info">
            <span className="kfpl-nm-stat-value">{articles.length}</span>
            <span className="kfpl-nm-stat-label">Total Articles</span>
          </div>
        </div>
        <div className="kfpl-nm-stat-card">
          <div className="kfpl-nm-stat-icon published">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="kfpl-nm-stat-info">
            <span className="kfpl-nm-stat-value">{publishedCount}</span>
            <span className="kfpl-nm-stat-label">Published</span>
          </div>
        </div>
        <div className="kfpl-nm-stat-card">
          <div className="kfpl-nm-stat-icon draft">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div className="kfpl-nm-stat-info">
            <span className="kfpl-nm-stat-value">{draftCount}</span>
            <span className="kfpl-nm-stat-label">Drafts</span>
          </div>
        </div>
        <div className="kfpl-nm-stat-card">
          <div className="kfpl-nm-stat-icon categories">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </div>
          <div className="kfpl-nm-stat-info">
            <span className="kfpl-nm-stat-value">{new Set(articles.map(a => a.category)).size}</span>
            <span className="kfpl-nm-stat-label">Categories</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="kfpl-nm-filters">
        <div className="kfpl-nm-search-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="kfpl-nm-search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="kfpl-input kfpl-nm-search"
            type="text"
            placeholder="Search articles by title or author..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="kfpl-select kfpl-nm-filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {NEWS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="kfpl-select kfpl-nm-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Status</option>
          <option value="Published">Published</option>
          <option value="Draft">Draft</option>
        </select>
      </div>

      {/* Articles Table */}
      <div className="kfpl-card">
        <div className="kfpl-table-scroll">
          <table className="kfpl-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Article</th>
                <th>Category</th>
                <th>Author</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span className="kfpl-spinner" style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Loading articles...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-muted)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, marginBottom: 8, opacity: 0.5 }}>
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No articles found</p>
                    <p style={{ fontSize: '0.8125rem' }}>Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : filtered.map(article => (
                <tr key={article.id}>
                  <td>
                    <div className="kfpl-nm-article-cell">
                      <div className="kfpl-nm-article-thumb">
                        {article.imageUrl ? (
                          <img src={article.imageUrl} alt="" />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        )}
                      </div>
                      <div className="kfpl-nm-article-info">
                        <span className="kfpl-nm-article-title">{article.title}</span>
                        <span className="kfpl-nm-article-excerpt">{article.excerpt}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="kfpl-nm-category-badge">{article.category}</span>
                  </td>
                  <td>
                    <span className="kfpl-nm-author">{article.author}</span>
                  </td>
                  <td>
                    <span className="kfpl-nm-date">
                      {new Date(article.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td>
                    <span className={`kfpl-nm-status-badge ${article.status.toLowerCase()}`}>
                      {article.status}
                    </span>
                  </td>
                  <td>
                    <div className="kfpl-nm-actions">
                      <Link to={`/news-media/${article.id}/edit`} className="kfpl-nm-action-btn edit" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </Link>
                      <button className="kfpl-nm-action-btn delete" title="Delete" onClick={() => handleDelete(article.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ END: NewsMediaList.jsx ============ */
