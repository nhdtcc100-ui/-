import { mockSuppliers } from '../data/mockData';
import { FiPlus, FiEdit2, FiPhone, FiMail } from 'react-icons/fi';

export default function Suppliers() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">الموردون</h1>
          <p className="page-subtitle">{mockSuppliers.length} موردين نشطين</p>
        </div>
        <button className="btn-primary-custom"><FiPlus size={15} /> إضافة مورد</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {mockSuppliers.map(s => (
          <div key={s.id} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 'var(--radius-md)',
                  background: 'var(--primary-100)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '1.3rem',
                }}>🏢</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.nameAr}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', direction: 'ltr' }}>{s.nameEn}</div>
                </div>
              </div>
              <span className={s.isActive ? 'badge-success' : 'badge-muted'}>{s.isActive ? 'نشط' : 'معطل'}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
              {s.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <FiPhone size={13} aria-hidden="true" /> <span dir="ltr">{s.phone}</span>
                </div>
              )}
              {s.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <FiMail size={13} aria-hidden="true" /> <span dir="ltr">{s.email}</span>
                </div>
              )}
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                🌍 {s.country} &nbsp;|&nbsp;
                <span className="num badge-muted" style={{ fontSize: '0.7rem' }}>{s.preferredCurrency}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-outline-custom" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}
                aria-label={`تعديل ${s.nameAr}`}>
                <FiEdit2 size={13} /> تعديل
              </button>
              <button className="btn-primary-custom" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}>
                📋 سجل التعاملات
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
