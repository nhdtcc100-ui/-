import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiDollarSign, FiTrendingUp, FiPackage,
  FiAlertTriangle, FiShoppingCart, FiPlus,
  FiBarChart2, FiLayers, FiTag, FiCreditCard, FiUser, FiClock
} from 'react-icons/fi';
import { storeService } from '../services/storeService';
import WarehouseCharts from '../components/dashboard/WarehouseCharts';
import type { SimpleProduct, SaleRecord, AppSettings } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => storeService.getSettings());

  const loadData = () => {
    setProducts(storeService.getProducts());
    setSales(storeService.getSales());
    setSettings(storeService.getSettings());
  };

  useEffect(() => {
    loadData();
    const unsub = storeService.subscribeSync(({ syncing: _s }) => {
      if (!_s) {
        loadData();
      }
    });
    const unsubProducts = storeService.subscribeProducts(() => {
      loadData();
    });
    const unsubSales = storeService.subscribeSales(() => {
      loadData();
    });
    return () => {
      unsub();
      unsubProducts();
      unsubSales();
    };
  }, []);

  // Financial & Inventory Core Metrics
  const cleanSales = useMemo(() => sales.filter(s => !storeService.isSummaryRow(s)), [sales]);
  const totalSalesAmount = useMemo(() => cleanSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0), [cleanSales]);
  const totalProfit = useMemo(() => cleanSales.reduce((sum, s) => sum + (Number(s.totalProfit) || 0), 0), [cleanSales]);
  const totalStockUnits = useMemo(() => products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0), [products]);
  const totalInitialCostAll = useMemo(() => products.reduce((sum, p) => sum + ((Number(p.costPrice) || 0) * (Number(p.stock) || 0)), 0), [products]);
  const totalExpectedSellAll = useMemo(() => products.reduce((sum, p) => sum + ((Number(p.sellPrice) || 0) * (Number(p.stock) || 0)), 0), [products]);
  const totalExpectedProfit = totalExpectedSellAll - totalInitialCostAll;
  const lowStockProducts = useMemo(() => products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5) && (Number(p.stock) || 0) > 0), [products]);
  const outOfStockProducts = useMemo(() => products.filter(p => (Number(p.stock) || 0) <= 0), [products]);
  const debtSales = useMemo(() => cleanSales.filter(s => (s.paymentStatus ?? 'paid') !== 'paid' || (Number(s.remainingAmount) || 0) > 0), [cleanSales]);
  const totalDebtRemaining = useMemo(() => debtSales.reduce((sum, s) => sum + (Number(s.remainingAmount) || 0), 0), [debtSales]);

  // Analytics Computations
  const profitMarginPct = totalSalesAmount > 0 ? Math.round((totalProfit / totalSalesAmount) * 100) : 0;

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header Toolbar: Title on right, Actions on left */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.85rem',
        background: 'var(--surface)',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              لوحة تحليل البيانات وإدارة المخزن
            </h2>
            <span style={{
              background: 'var(--primary-100)',
              color: 'var(--primary-700)',
              padding: '0.2rem 0.55rem',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {settings.storeName}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            تحليل شامل وفوري للتدفقات النقدية، المبيعات، كلفة البضاعة، وحالة الأرصدة في المخزن
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/sell')}
            className="btn-primary-custom"
            style={{ background: '#16A34A', borderColor: '#16A34A', fontWeight: 700, padding: '0.45rem 0.85rem' }}
          >
            <FiShoppingCart size={15} />
            بيع منتج الآن
          </button>

          <button
            onClick={() => navigate('/products')}
            className="btn-primary-custom"
            style={{ fontWeight: 700, padding: '0.45rem 0.85rem' }}
          >
            <FiPlus size={15} />
            إضافة منتج
          </button>
        </div>
      </div>



      {/* ── Key Analytics Cards Grid (Balanced Side-by-Side) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* 1. إجمالي المبيعات المحققة */}
        <div className="stat-card" style={{ borderRight: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label" style={{ fontWeight: 700, margin: 0 }}>إجمالي المبيعات</div>
            <div className="stat-card-icon" style={{ background: '#EFF6FF', color: '#2563EB', width: 36, height: 36, marginBottom: 0 }}>
              <FiDollarSign size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#2563EB', marginTop: '0.4rem', fontSize: '1.45rem' }}>
            {totalSalesAmount.toLocaleString()} <small style={{ fontSize: '0.7rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            من {sales.length} عملية بيع مسجلة
          </div>
        </div>

        {/* 2. صافي الأرباح المحققة */}
        <div className="stat-card" style={{ borderRight: '4px solid #16A34A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label" style={{ fontWeight: 700, margin: 0 }}>صافي الأرباح المحققة</div>
            <div className="stat-card-icon" style={{ background: '#F0FDF4', color: '#16A34A', width: 36, height: 36, marginBottom: 0 }}>
              <FiTrendingUp size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#16A34A', marginTop: '0.4rem', fontSize: '1.45rem' }}>
            +{totalProfit.toLocaleString()} <small style={{ fontSize: '0.7rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#16A34A', marginTop: '0.25rem', fontWeight: 600 }}>
            هامش ربح إجمالي {profitMarginPct}%
          </div>
        </div>

        {/* 3. كلفة الشراء الأولية للبضاعة */}
        <div className="stat-card" style={{ borderRight: '4px solid #4F46E5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label" style={{ fontWeight: 700, margin: 0 }}>كلفة الشراء الأولية</div>
            <div className="stat-card-icon" style={{ background: '#EEF2FF', color: '#4F46E5', width: 36, height: 36, marginBottom: 0 }}>
              <FiLayers size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#4F46E5', marginTop: '0.4rem', fontSize: '1.45rem' }}>
            {totalInitialCostAll.toLocaleString()} <small style={{ fontSize: '0.7rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            رأس المال المستثمر في البضاعة
          </div>
        </div>

        {/* 4. إجمالي قيمة البيع المتوقعة للمخزون */}
        <div className="stat-card" style={{ borderRight: '4px solid #0284C7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label" style={{ fontWeight: 700, margin: 0 }}>القيمة البيعية المتوقعة</div>
            <div className="stat-card-icon" style={{ background: '#E0F2FE', color: '#0284C7', width: 36, height: 36, marginBottom: 0 }}>
              <FiBarChart2 size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#0284C7', marginTop: '0.4rem', fontSize: '1.45rem' }}>
            {totalExpectedSellAll.toLocaleString()} <small style={{ fontSize: '0.7rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            أرباح متوقعة: +{totalExpectedProfit.toLocaleString()}
          </div>
        </div>

        {/* 5. كمية المخزون والأصناف */}
        <div className="stat-card" style={{ borderRight: '4px solid #7C3AED' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label" style={{ fontWeight: 700, margin: 0 }}>قطع وأصناف المخزون</div>
            <div className="stat-card-icon" style={{ background: '#F5F3FF', color: '#7C3AED', width: 36, height: 36, marginBottom: 0 }}>
              <FiPackage size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: '#7C3AED', marginTop: '0.4rem', fontSize: '1.45rem' }}>
            {totalStockUnits.toLocaleString()} <small style={{ fontSize: '0.7rem' }}>قطعة</small>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            متوزعة على {products.length} صنف مسجل
          </div>
        </div>

        {/* 6. تنبيهات نواقص المخزن */}
        <div className="stat-card" style={{ borderRight: lowStockProducts.length > 0 ? '4px solid #DC2626' : '4px solid #16A34A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label" style={{ fontWeight: 700, margin: 0 }}>نواقص المخزون</div>
            <div className="stat-card-icon" style={{
              background: lowStockProducts.length > 0 ? '#FEF2F2' : '#F0FDF4',
              color: lowStockProducts.length > 0 ? '#DC2626' : '#16A34A',
              width: 36, height: 36, marginBottom: 0
            }}>
              <FiAlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: lowStockProducts.length > 0 ? '#DC2626' : '#16A34A', marginTop: '0.4rem', fontSize: '1.45rem' }}>
            {lowStockProducts.length} <small style={{ fontSize: '0.7rem' }}>أصناف</small>
          </div>
          <div style={{ fontSize: '0.74rem', color: lowStockProducts.length > 0 ? '#DC2626' : 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {lowStockProducts.length > 0 ? 'بحاجة إلى إعادة شراء' : 'المخزون متوفر بالكامل'}
          </div>
        </div>
      </div>

      {/* ── Warehouse Interactive Charts Section (Placed Directly Below Main KPI Cards) ── */}
      <WarehouseCharts products={products} sales={sales} settings={settings} />

      {/* ── Operational Tables (Placed One Below The Other in an Organized Layout) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        
        {/* 1. جدول آخر عمليات البيع المسجلة (Full Width) */}
        <div className="table-card" style={{ width: '100%' }}>
          <div style={{
            padding: '1.1rem 1.35rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiDollarSign size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>آخر عمليات البيع المسجلة</h3>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                أحدث الفواتير المنجزة مع تفاصيل المنتجات وصافي الأرباح المحققة
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => navigate('/sell')}
                className="btn-primary-custom"
                style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem', background: '#16A34A', borderColor: '#16A34A' }}
              >
                <FiShoppingCart size={13} />
                بيع جديد
              </button>
              <button
                onClick={() => navigate('/sales')}
                className="btn-outline-custom"
                style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem' }}
              >
                عرض كل المبيعات ({sales.length})
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {sales.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                لم يتم تسجيل أي عمليات بيع بعد.
                <div style={{ marginTop: '0.75rem' }}>
                  <button onClick={() => navigate('/sell')} className="btn-primary-custom" style={{ fontSize: '0.8rem' }}>
                    تسجيل أول عملية بيع الآن
                  </button>
                </div>
              </div>
            ) : (
              <table className="table-custom" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '110px' }}>رقم الفاتورة</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>تاريخ البيع</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>العميل</th>
                    <th style={{ textAlign: 'right' }}>المنتجات المباعة والكميات</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>إجمالي الفاتورة</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>صافي الربح</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {cleanSales.slice(0, 8).map(s => {
                    const dateFormatted = new Date(s.createdAt || Date.now()).toLocaleDateString('ar-IQ', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const sTotal = Number(s.totalAmount) || 0;
                    const sProfit = Number(s.totalProfit) || 0;

                    return (
                      <tr key={s.id}>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)' }}>
                          {s.invoiceNumber}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {dateFormatted}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {s.customerName || 'عميل نقدي'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-start' }}>
                            {(s.items || []).map((i, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: 'var(--bg)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px',
                                  padding: '0.15rem 0.5rem',
                                  fontSize: '0.74rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <strong>{i.productName}</strong>
                                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>×{i.quantity}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.92rem' }}>
                          {sTotal.toLocaleString()} <small style={{ fontSize: '0.65rem' }}>{settings.currency}</small>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.9rem' }}>
                            +{sProfit.toLocaleString()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => navigate('/sales')}
                            className="btn-outline-custom"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                            title="عرض تفاصيل الفاتورة"
                          >
                            عرض
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 2. جدول حالة أصناف المخزون والتنبيهات (Full Width) */}
        <div className="table-card" style={{ width: '100%' }}>
          <div style={{
            padding: '1.1rem 1.35rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiPackage size={18} color="#7C3AED" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>حالة أصناف المخزون والتنبيهات</h3>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                مراقبة كميات البضاعة، كلفة الشراء الأولية، والقيمة البيعية التقديرية
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => navigate('/products')}
                className="btn-primary-custom"
                style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem' }}
              >
                <FiPlus size={13} />
                إضافة صنف
              </button>
              <button
                onClick={() => navigate('/products')}
                className="btn-outline-custom"
                style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem' }}
              >
                إدارة كامل المخزن ({products.length})
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {products.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                المخزن فارغ حالياً.
                <div style={{ marginTop: '0.75rem' }}>
                  <button onClick={() => navigate('/products')} className="btn-primary-custom" style={{ fontSize: '0.8rem' }}>
                    إضافة أول صنف في المخزن
                  </button>
                </div>
              </div>
            ) : (
              <table className="table-custom" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>المنتج والباركود</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>التصنيف</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>سعر التكلفة</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>سعر البيع</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>الكمية</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>كلفة الشراء الأولية</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>القيمة المتوقعة</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>حالة المخزون</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 10).map(p => {
                    const isLow = p.stock <= p.minStock;
                    const isOutOfStock = p.stock <= 0;
                    const initialCost = (p.costPrice || 0) * (p.stock || 0);
                    const expectedVal = (p.sellPrice || 0) * (p.stock || 0);

                    return (
                      <tr key={p.id}>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                            <FiTag size={10} /> {p.barcode || 'بدون باركود'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            background: '#F1F5F9',
                            color: '#475569',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 600
                          }}>
                            {p.category || 'عام'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {(p.costPrice || 0).toLocaleString()} <small style={{ fontSize: '0.65rem' }}>{settings.currency}</small>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                          {(p.sellPrice || 0).toLocaleString()} <small style={{ fontSize: '0.65rem' }}>{settings.currency}</small>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontWeight: 900,
                            fontSize: '1rem',
                            color: isOutOfStock ? 'var(--danger)' : isLow ? '#D97706' : 'var(--text-primary)',
                          }}>
                            {p.stock}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', background: '#F8FAFC', fontWeight: 800, color: '#4F46E5' }}>
                          {initialCost.toLocaleString()} <small style={{ fontSize: '0.65rem' }}>{settings.currency}</small>
                        </td>
                        <td style={{ textAlign: 'center', background: '#F8FAFC', fontWeight: 800, color: '#0284C7' }}>
                          {expectedVal.toLocaleString()} <small style={{ fontSize: '0.65rem' }}>{settings.currency}</small>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isOutOfStock ? (
                            <span className="badge-custom badge-danger">نفد ❌</span>
                          ) : isLow ? (
                            <span className="badge-custom badge-warning">منخفض ({p.stock}) ⚠️</span>
                          ) : (
                            <span className="badge-custom badge-success">متوفر ({p.stock}) ✅</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => navigate(`/sell?productId=${p.id}`)}
                            className="btn-primary-custom"
                            style={{
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.74rem',
                              background: '#16A34A',
                              borderColor: '#16A34A',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}
                          >
                            <FiShoppingCart size={11} />
                            بيع
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 3. لوحة تنبيهات نواقص المخزون */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
          <div className="table-card" style={{ width: '100%', borderRight: '4px solid #DC2626' }}>
            <div style={{
              padding: '1rem 1.35rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '0.75rem',
              background: 'linear-gradient(135deg, #FEF2F2, #FFF5F5)',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiAlertTriangle size={18} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#B91C1C' }}>
                  ⚠️ تنبيهات نواقص المخزون
                </h3>
                <span style={{
                  background: '#DC2626', color: '#fff',
                  padding: '0.1rem 0.5rem', borderRadius: '20px',
                  fontSize: '0.72rem', fontWeight: 800,
                }}>
                  {outOfStockProducts.length + lowStockProducts.length} منتج
                </span>
              </div>
              <button
                onClick={() => navigate('/products')}
                className="btn-outline-custom"
                style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem', color: '#DC2626', borderColor: '#DC2626' }}
              >
                <FiPackage size={13} /> إدارة المخزون
              </button>
            </div>

            <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Completely out of stock */}
              {outOfStockProducts.length > 0 && (
                <div style={{ marginBottom: '0.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#DC2626', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    🔴 نفدت بالكامل ({outOfStockProducts.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {outOfStockProducts.map(p => (
                      <div
                        key={p.id}
                        style={{
                          background: '#FEF2F2', border: '1.5px solid #FECACA',
                          borderRadius: 'var(--radius-md)', padding: '0.45rem 0.85rem',
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span style={{ fontWeight: 800, color: '#B91C1C' }}>{p.name}</span>
                        <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.7rem' }}>نفد ❌</span>
                        <button
                          onClick={() => navigate('/products')}
                          style={{
                            background: '#DC2626', color: '#fff',
                            border: 'none', borderRadius: '4px',
                            padding: '0.15rem 0.4rem', fontSize: '0.68rem',
                            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          شراء
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Low stock */}
              {lowStockProducts.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D97706', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    ⚠️ منخفض (أقل من الحد الأدنى — {lowStockProducts.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {lowStockProducts.map(p => (
                      <div
                        key={p.id}
                        style={{
                          background: '#FFFBEB', border: '1.5px solid #FDE68A',
                          borderRadius: 'var(--radius-md)', padding: '0.45rem 0.85rem',
                          display: 'flex', alignItems: 'center', gap: '0.45rem',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span style={{ fontWeight: 800, color: '#92400E' }}>{p.name}</span>
                        <span style={{ color: '#D97706', fontWeight: 700, fontSize: '0.7rem' }}>
                          {p.stock} / {p.minStock} (الحد الأدنى)
                        </span>
                        <button
                          onClick={() => navigate(`/sell?productId=${p.id}`)}
                          style={{
                            background: '#F59E0B', color: '#fff',
                            border: 'none', borderRadius: '4px',
                            padding: '0.15rem 0.4rem', fontSize: '0.68rem',
                            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          بيع
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. جدول الديون والذمم المالية */}
        {debtSales.length > 0 && (
          <div className="table-card" style={{ width: '100%', borderRight: '4px solid #D97706' }}>
            <div style={{
              padding: '1.1rem 1.35rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '0.75rem',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FiCreditCard size={18} color="#D97706" />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>ذمم العملاء والديون المتبقية</h3>
                  <span style={{
                    background: '#D97706', color: '#fff',
                    padding: '0.1rem 0.5rem', borderRadius: '20px',
                    fontSize: '0.72rem', fontWeight: 800,
                  }}>
                    {debtSales.length} فاتورة
                  </span>
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  إجمالي الديون المتبقية: <strong style={{ color: '#DC2626' }}>{totalDebtRemaining.toLocaleString()} {settings.currency}</strong>
                </p>
              </div>
              <button
                onClick={() => navigate('/sales')}
                className="btn-outline-custom"
                style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem', color: '#D97706', borderColor: '#D97706' }}
              >
                عرض كل الفواتير
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table-custom" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '110px' }}>رقم الفاتورة</th>
                    <th style={{ textAlign: 'right', width: '130px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FiUser size={12} /> العميل</div>
                    </th>
                    <th style={{ textAlign: 'center', width: '120px' }}>إجمالي الفاتورة</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>تم دفعه</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>المتبقي (دين)</th>
                    <th style={{ textAlign: 'center', width: '100px' }}>الحالة</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}><FiClock size={12} /> التاريخ</div>
                    </th>
                    <th style={{ textAlign: 'center', width: '80px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {debtSales.slice(0, 8).map(s => {
                    const paid = s.paidAmount ?? 0;
                    const rem = s.remainingAmount ?? Math.max(0, s.totalAmount - paid);
                    return (
                      <tr key={s.id} style={{ background: 'rgba(255,251,235,0.5)' }}>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)' }}>{s.invoiceNumber}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {s.customerName || 'عميل'}
                          {s.customerPhone && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 400 }}>{s.customerPhone}</div>}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {s.totalAmount.toLocaleString()} <small style={{ fontSize: '0.65rem' }}>{settings.currency}</small>
                        </td>
                        <td style={{ textAlign: 'center', color: '#15803D', fontWeight: 700 }}>
                          {paid.toLocaleString()} <small style={{ fontSize: '0.65rem' }}>{settings.currency}</small>
                        </td>
                        <td style={{ textAlign: 'center', color: '#DC2626', fontWeight: 800 }}>
                          {rem.toLocaleString()} <small style={{ fontSize: '0.65rem' }}>{settings.currency}</small>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {s.paymentStatus === 'partial'
                            ? <span className="badge-custom badge-warning">جزئي ⏳</span>
                            : <span className="badge-custom badge-danger">دين 🔴</span>
                          }
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(s.createdAt).toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' })}
                          {s.dueDate && <div style={{ color: '#D97706', fontWeight: 700, fontSize: '0.7rem' }}>استحق: {s.dueDate}</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => navigate('/sales')}
                            style={{
                              background: '#FFF7ED', color: '#D97706',
                              border: '1.5px solid #FDE68A', borderRadius: '6px',
                              padding: '0.2rem 0.5rem', fontSize: '0.72rem',
                              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                            }}
                          >
                            <FiCreditCard size={11} /> دفع
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
