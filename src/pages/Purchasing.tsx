import { useState } from 'react';
import { FiPlus, FiSearch } from 'react-icons/fi';
import { mockPurchaseOrders, mockSuppliers } from '../data/mockData';

const statusMeta: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'مسودة',          cls: 'badge-muted'    },
  sent:      { label: 'مرسل',           cls: 'badge-primary'  },
  partial:   { label: 'مستلم جزئياً',  cls: 'badge-warning'  },
  complete:  { label: 'مكتمل',          cls: 'badge-success'  },
  cancelled: { label: 'ملغي',           cls: 'badge-danger'   },
};

const getSupplierName = (id: string) =>
  mockSuppliers.find(s => s.id === id)?.nameAr ?? '—';

export default function Purchasing() {
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [activeTab, setTab]     = useState<'po' | 'grn'>('po');

  const filtered = mockPurchaseOrders.filter(po => {
    const sup = getSupplierName(po.supplierId);
    return (
      (po.id.includes(search) || sup.includes(search)) &&
      (!status || po.status === status)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">الشراء</h1>
          <p className="page-subtitle">أوامر الشراء واستلام البضاعة</p>
        </div>
        <button className="btn-primary-custom" aria-label="إنشاء أمر شراء جديد">
          <FiPlus size={15} /> أمر شراء جديد
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        {[{ k: 'po', label: '📋 أوامر الشراء' }, { k: 'grn', label: '📦 وثائق الاستلام' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as 'po' | 'grn')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.6rem 1.1rem', fontFamily: 'Cairo, sans-serif',
              fontSize: '0.9rem', fontWeight: activeTab === t.k ? 700 : 500,
              color: activeTab === t.k ? 'var(--primary-500)' : 'var(--text-secondary)',
              borderBottom: activeTab === t.k ? '2.5px solid var(--primary-500)' : '2.5px solid transparent',
              marginBottom: '-1px',
            }}
            role="tab" aria-selected={activeTab === t.k}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-bar">
          <FiSearch className="search-icon" size={15} aria-hidden="true" />
          <input type="search" placeholder="ابحث برقم الأمر أو المورد..."
            value={search} onChange={e => setSearch(e.target.value)} aria-label="بحث" />
        </div>
        <select className="form-control-custom" style={{ width: 'auto', minWidth: 160 }}
          value={status} onChange={e => setStatus(e.target.value)} aria-label="فلترة بالحالة">
          <option value="">جميع الحالات</option>
          {Object.entries(statusMeta).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" aria-label="أوامر الشراء">
            <thead>
              <tr>
                <th>رقم الأمر</th>
                <th>المورد</th>
                <th>التاريخ</th>
                <th>العملة</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(po => {
                const meta = statusMeta[po.status];
                return (
                  <tr key={po.id}>
                    <td><span style={{ fontWeight: 700, fontFamily: 'Inter', color: 'var(--primary-500)' }}>{po.id}</span></td>
                    <td style={{ fontWeight: 500 }}>{getSupplierName(po.supplierId)}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: 'Inter' }}>{po.orderDate}</td>
                    <td>
                      <span className="badge-muted num" style={{ fontSize: '0.72rem' }}>
                        {po.currency} {po.exchangeRate !== 1 && `(${po.exchangeRate.toLocaleString()})`}
                      </span>
                    </td>
                    <td><span className={meta.cls}>{meta.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-outline-custom" style={{ fontSize: '0.75rem', padding: '0.28rem 0.65rem' }}
                          aria-label={`تفاصيل ${po.id}`}>
                          تفاصيل
                        </button>
                        {po.status === 'partial' || po.status === 'sent' ? (
                          <button className="btn-primary-custom" style={{ fontSize: '0.75rem', padding: '0.28rem 0.65rem' }}>
                            📦 استلام
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>لا توجد نتائج</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
