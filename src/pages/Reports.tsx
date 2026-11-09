import { useNavigate } from 'react-router-dom';
import { FiDownload } from 'react-icons/fi';

const reportGroups = [
  {
    title: '📦 تقارير المخزون', reports: [
      { id: 'r1', name: 'المخزون الحالي',            desc: 'الرصيد الحالي لكل منتج ومتغير وموقع' },
      { id: 'r2', name: 'المنتجات منخفضة المخزون',  desc: 'المنتجات التي وصلت للحد الأدنى' },
      { id: 'r3', name: 'المنتجات الراكدة',          desc: 'منتجات بدون حركة خلال 30 يوماً' },
      { id: 'r4', name: 'انتهاء الصلاحية',           desc: 'منتجات تنتهي خلال 60 يوماً' },
    ],
  },
  {
    title: '🔄 تقارير الحركة', reports: [
      { id: 'r5', name: 'سجل حركة المخزون',  desc: 'كل عملية تغيير في الكمية' },
      { id: 'r6', name: 'التالف والفاقد',    desc: 'سجل المنتجات التالفة ومجموع الخسائر' },
      { id: 'r7', name: 'النقل بين المخازن', desc: 'عمليات نقل المخزون بين المخازن' },
    ],
  },
  {
    title: '🛒 تقارير المشتريات', reports: [
      { id: 'r8', name: 'المشتريات بالفترة',  desc: 'إجمالي المشتريات خلال فترة محددة' },
      { id: 'r9', name: 'المشتريات بالمورد',  desc: 'تحليل المشتريات حسب المورد' },
    ],
  },
  {
    title: '📊 تقارير الجرد', reports: [
      { id: 'r10', name: 'نتائج الجرد',     desc: 'مقارنة النظام مع الواقع' },
      { id: 'r11', name: 'فروقات الجرد',    desc: 'المنتجات التي بها فرق في الجرد' },
    ],
  },
];

export default function Reports() {
  const navigate = useNavigate();
  void navigate;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">التقارير</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {reportGroups.map(group => (
          <div key={group.title}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
              {group.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {group.reports.map(r => (
                <div
                  key={r.id}
                  className="card"
                  style={{ padding: '1.1rem 1.25rem', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                  onClick={() => {}}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && {}}
                  aria-label={r.name}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.3rem' }}>{r.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.desc}</div>
                    </div>
                    <button
                      className="btn-outline-custom"
                      style={{ padding: '0.3rem 0.5rem', flexShrink: 0, marginRight: '0.5rem' }}
                      onClick={e => { e.stopPropagation(); alert('تصدير التقرير بتنسيق Excel / CSV قريباً'); }}
                      aria-label={`تصدير ${r.name}`}
                    >
                      <FiDownload size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
