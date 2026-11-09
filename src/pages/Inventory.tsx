import { useState, useMemo } from 'react';
import { FiSearch, FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { mockStockLevels, mockVariants, mockProducts, mockWarehouses, mockMovements } from '../data/mockData';
import type { MovementType } from '../types';

const movementLabels: Record<MovementType, { label: string; cls: string }> = {
  PURCHASE_RECEIPT: { label: 'استلام شراء',  cls: 'badge-success' },
  SALE:             { label: 'بيع',           cls: 'badge-warning' },
  TRANSFER_IN:      { label: 'نقل وارد',     cls: 'badge-primary' },
  TRANSFER_OUT:     { label: 'نقل صادر',    cls: 'badge-primary' },
  RETURN_IN:        { label: 'مرتجع وارد',  cls: 'badge-success' },
  RETURN_OUT:       { label: 'مرتجع صادر', cls: 'badge-warning' },
  DAMAGE:           { label: 'تالف',          cls: 'badge-danger'  },
  ADJUSTMENT:       { label: 'تسوية جرد',   cls: 'badge-muted'   },
};

const getProductInfo = (variantId: string) => {
  const variant = mockVariants.find(v => v.id === variantId);
  const product = variant ? mockProducts.find(p => p.id === variant.productId) : null;
  const label = [variant?.size, variant?.color].filter(Boolean).join(' - ');
  return { productName: product?.nameAr ?? '—', variantLabel: label };
};

const getWarehouseName = (id: string) =>
  mockWarehouses.find(w => w.id === id)?.nameAr ?? '—';

type Tab = 'stock' | 'movements';

export default function Inventory() {
  const [tab, setTab]           = useState<Tab>('stock');
  const [search, setSearch]     = useState('');
  const [whFilter, setWhFilter] = useState('');
  const [typeFilter, setType]   = useState<MovementType | ''>('');

  // Stock view
  const stockRows = useMemo(() => {
    return mockStockLevels.filter(s => {
      const { productName, variantLabel } = getProductInfo(s.variantId);
      const matchSearch = productName.includes(search) || variantLabel.includes(search);
      const matchWh     = !whFilter || s.warehouseId === whFilter;
      return matchSearch && matchWh;
    });
  }, [search, whFilter]);

  // Movements view
  const movRows = useMemo(() => {
    return mockMovements.filter(m => {
      const { productName } = getProductInfo(m.variantId);
      const matchSearch = productName.includes(search);
      const matchType   = !typeFilter || m.movementType === typeFilter;
      return matchSearch && matchType;
    });
  }, [search, typeFilter]);

  const now = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const getExpiryStatus = (expiry?: string) => {
    if (!expiry) return null;
    const exp = new Date(expiry);
    const diff = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff <= 0)  return { cls: 'badge-danger',  label: 'منتهي' };
    if (diff <= 30) return { cls: 'badge-danger',  label: `${diff} يوم` };
    if (diff <= 60) return { cls: 'badge-warning', label: `${diff} يوم` };
    return { cls: 'badge-success', label: expiry };
  };

  void now;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">المخزون</h1>
          <p className="page-subtitle">الرصيد الحالي وسجل جميع الحركات</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {(['stock', 'movements'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.6rem 1.1rem', fontFamily: 'Cairo, sans-serif',
              fontSize: '0.9rem', fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--primary-500)' : 'var(--text-secondary)',
              borderBottom: tab === t ? '2.5px solid var(--primary-500)' : '2.5px solid transparent',
              marginBottom: '-1px', transition: 'all 0.2s',
            }}
            aria-selected={tab === t}
            role="tab"
          >
            {t === 'stock' ? '📦 الرصيد الحالي' : '🔄 سجل الحركة'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-bar">
          <FiSearch className="search-icon" size={15} aria-hidden="true" />
          <input type="search" placeholder="ابحث بالاسم أو الباركود..."
            value={search} onChange={e => setSearch(e.target.value)}
            aria-label="بحث في المخزون" />
        </div>
        {tab === 'stock' && (
          <select className="form-control-custom" style={{ width: 'auto', minWidth: 160 }}
            value={whFilter} onChange={e => setWhFilter(e.target.value)} aria-label="فلترة بالمخزن">
            <option value="">جميع المخازن</option>
            {mockWarehouses.map(w => <option key={w.id} value={w.id}>{w.nameAr}</option>)}
          </select>
        )}
        {tab === 'movements' && (
          <select className="form-control-custom" style={{ width: 'auto', minWidth: 160 }}
            value={typeFilter} onChange={e => setType(e.target.value as MovementType | '')}
            aria-label="فلترة بنوع الحركة">
            <option value="">جميع الحركات</option>
            {Object.entries(movementLabels).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>

          {/* Stock Table */}
          {tab === 'stock' && (
            <table className="data-table" aria-label="الرصيد الحالي">
              <thead>
                <tr>
                  <th>المنتج / المتغير</th>
                  <th>المخزن</th>
                  <th>الموقع</th>
                  <th>الدفعة</th>
                  <th>الكمية</th>
                  <th>الصلاحية</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map(s => {
                  const { productName, variantLabel } = getProductInfo(s.variantId);
                  const expStatus = getExpiryStatus(s.expiryDate);
                  const variant = mockVariants.find(v => v.id === s.variantId);
                  const isLow = variant && s.quantity <= variant.minStock;

                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{productName}</div>
                        {variantLabel && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{variantLabel}</div>}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{getWarehouseName(s.warehouseId)}</td>
                      <td><span className="badge-muted num" style={{ fontSize: '0.72rem', fontFamily: 'Inter' }}>A-03-L2</span></td>
                      <td><span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'Inter' }}>{s.batchNumber}</span></td>
                      <td>
                        <span
                          className="num"
                          style={{ fontWeight: 700, color: isLow ? 'var(--danger-500)' : 'var(--text-primary)' }}
                        >
                          {s.quantity}
                        </span>
                        {isLow && <span className="badge-danger" style={{ marginRight: '0.4rem', fontSize: '0.65rem' }}>منخفض</span>}
                      </td>
                      <td>
                        {expStatus
                          ? <span className={expStatus.cls}>{expStatus.label}</span>
                          : <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Movements Table */}
          {tab === 'movements' && (
            <table className="data-table" aria-label="سجل حركة المخزون">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>نوع الحركة</th>
                  <th>المنتج</th>
                  <th>الكمية</th>
                  <th>الرصيد قبل</th>
                  <th>الرصيد بعد</th>
                  <th>المرجع</th>
                </tr>
              </thead>
              <tbody>
                {movRows.map(m => {
                  const { productName, variantLabel } = getProductInfo(m.variantId);
                  const meta = movementLabels[m.movementType as MovementType] || { label: String(m.movementType), cls: 'badge-muted' };
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'Inter' }}>
                        {new Date(m.createdAt).toLocaleDateString('ar-IQ')}
                        <div style={{ fontSize: '0.68rem' }}>{new Date(m.createdAt).toLocaleTimeString('ar-IQ')}</div>
                      </td>
                      <td><span className={meta.cls}>{meta.label}</span></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{productName}</div>
                        {variantLabel && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{variantLabel}</div>}
                      </td>
                      <td>
                        <span className="num" style={{ fontWeight: 700, color: m.quantity > 0 ? 'var(--success-500)' : 'var(--danger-500)' }}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      </td>
                      <td><span className="num" style={{ color: 'var(--text-secondary)' }}>{m.balanceBefore}</span></td>
                      <td><span className="num" style={{ fontWeight: 600 }}>{m.balanceAfter}</span></td>
                      <td>
                        {m.referenceId
                          ? <span className="badge-primary num" style={{ fontSize: '0.68rem' }}>{m.referenceId}</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {tab === 'stock' ? `${stockRows.length} سجل` : `${movRows.length} حركة`}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn-outline-custom" style={{ padding: '0.3rem 0.6rem' }} disabled aria-label="الصفحة السابقة"><FiArrowRight size={14} /></button>
            <button className="btn-primary-custom" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}>1</button>
            <button className="btn-outline-custom" style={{ padding: '0.3rem 0.6rem' }} disabled aria-label="الصفحة التالية"><FiArrowLeft size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
