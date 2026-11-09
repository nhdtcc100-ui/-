import { FiPlus } from 'react-icons/fi';

const counts = [
  { id: 'CNT-005', type: 'كامل', date: '2026-10-03', progress: 100, status: 'pending_approval' },
  { id: 'CNT-004', type: 'جزئي (A)', date: '2026-09-15', progress: 100, status: 'approved' },
  { id: 'CNT-003', type: 'عشوائي', date: '2026-08-20', progress: 100, status: 'approved' },
];

const statusMeta: Record<string, { label: string; cls: string }> = {
  in_progress:      { label: 'جاري',             cls: 'badge-primary'  },
  pending_approval: { label: 'بانتظار اعتماد',   cls: 'badge-warning'  },
  approved:         { label: 'معتمد',             cls: 'badge-success'  },
  rejected:         { label: 'مرفوض',            cls: 'badge-danger'   },
};

export default function InventoryCounts() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">الجرد</h1>
          <p className="page-subtitle">جلسات الجرد الدوري والتسويات</p>
        </div>
        <button className="btn-primary-custom"><FiPlus size={15} /> جلسة جرد جديدة</button>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" aria-label="جلسات الجرد">
            <thead>
              <tr>
                <th>رقم الجلسة</th>
                <th>نوع الجرد</th>
                <th>التاريخ</th>
                <th>التقدم</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {counts.map(c => {
                const meta = statusMeta[c.status];
                return (
                  <tr key={c.id}>
                    <td><span style={{ fontWeight: 700, fontFamily: 'Inter', color: 'var(--primary-500)' }}>{c.id}</span></td>
                    <td>{c.type}</td>
                    <td style={{ fontFamily: 'Inter', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{c.date}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', minWidth: 80 }}>
                          <div style={{ height: '100%', width: `${c.progress}%`, background: 'var(--success-500)', borderRadius: 99 }} />
                        </div>
                        <span className="num" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.progress}%</span>
                      </div>
                    </td>
                    <td><span className={meta.cls}>{meta.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-outline-custom" style={{ fontSize: '0.75rem', padding: '0.28rem 0.65rem' }}>مراجعة</button>
                        {c.status === 'pending_approval' && (
                          <button className="btn-primary-custom" style={{ fontSize: '0.75rem', padding: '0.28rem 0.65rem' }}>✓ اعتماد</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
