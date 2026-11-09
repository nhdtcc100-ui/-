import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPieChart,
  FiTrendingUp,
  FiShoppingBag,
  FiLayers,
  FiDollarSign,
  FiPackage,
  FiCalendar,
  FiLink,
  FiX,
  FiRefreshCw
} from 'react-icons/fi';
import type { SimpleProduct, SaleRecord, AppSettings } from '../../types';

interface WarehouseChartsProps {
  products: SimpleProduct[];
  sales: SaleRecord[];
  settings: AppSettings;
}

const PALETTE = [
  '#2563EB', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1',
  '#14B8A6', '#84CC16', '#E11D48', '#0284C7'
];

type TimePeriod = 'daily' | 'weekly' | 'monthly';
type ChartViewMode = 'all' | 'revenue' | 'profit' | 'units';

// Geometry helpers for SVG Donut
function polarToCartesian(cx: number, cy: number, radius: number, angleInRad: number) {
  return {
    x: cx + radius * Math.cos(angleInRad),
    y: cy + radius * Math.sin(angleInRad)
  };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startAngle: number,
  endAngle: number
): string {
  const angleDiff = endAngle - startAngle;
  if (angleDiff >= 2 * Math.PI - 0.001) {
    const midAngle = startAngle + Math.PI;
    const p1Out = polarToCartesian(cx, cy, rOut, startAngle);
    const p2Out = polarToCartesian(cx, cy, rOut, midAngle);
    const p1In = polarToCartesian(cx, cy, rIn, startAngle);
    const p2In = polarToCartesian(cx, cy, rIn, midAngle);
    return [
      `M ${p1Out.x} ${p1Out.y}`,
      `A ${rOut} ${rOut} 0 0 1 ${p2Out.x} ${p2Out.y}`,
      `A ${rOut} ${rOut} 0 0 1 ${p1Out.x} ${p1Out.y}`,
      `M ${p1In.x} ${p1In.y}`,
      `A ${rIn} ${rIn} 0 0 0 ${p2In.x} ${p2In.y}`,
      `A ${rIn} ${rIn} 0 0 0 ${p1In.x} ${p1In.y}`,
      'Z'
    ].join(' ');
  }

  const pStartOut = polarToCartesian(cx, cy, rOut, startAngle);
  const pEndOut = polarToCartesian(cx, cy, rOut, endAngle);
  const pEndIn = polarToCartesian(cx, cy, rIn, endAngle);
  const pStartIn = polarToCartesian(cx, cy, rIn, startAngle);
  const largeArcFlag = angleDiff > Math.PI ? 1 : 0;

  return [
    `M ${pStartOut.x} ${pStartOut.y}`,
    `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${pEndOut.x} ${pEndOut.y}`,
    `L ${pEndIn.x} ${pEndIn.y}`,
    `A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${pStartIn.x} ${pStartIn.y}`,
    'Z'
  ].join(' ');
}

function getLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function WarehouseCharts({ products, sales, settings }: WarehouseChartsProps) {
  const navigate = useNavigate();

  // ── Unified Connected State ─────────────────────────────
  // Active product selection (connecting Donut -> Sales chart)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);

  // Sales Trend chart state
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');
  const [viewMode, setViewMode] = useState<ChartViewMode>('all');
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<number | null>(null);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number | null>(null);

  // ── Donut Chart Data Calculation ────────────────────────
  const { pieSlices, totalStockUnits } = useMemo(() => {
    const valid = products
      .map(p => ({
        id: p.id,
        name: p.name,
        value: Math.max(0, p.stock || 0),
        costPrice: p.costPrice || 0,
        sellPrice: p.sellPrice || 0,
        minStock: p.minStock || 0,
        stock: p.stock || 0,
        category: p.category || 'عام'
      }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value);

    const total = valid.reduce((sum, item) => sum + item.value, 0);

    let currentAngle = -Math.PI / 2;
    const gap = valid.length > 1 ? 0.03 : 0;

    const slices = valid.map((item, idx) => {
      const fraction = total > 0 ? item.value / total : 0;
      const angleSpan = fraction * 2 * Math.PI;
      const start = currentAngle;
      const end = currentAngle + angleSpan;
      currentAngle = end;

      return {
        ...item,
        index: idx,
        color: PALETTE[idx % PALETTE.length],
        percentage: Math.round(fraction * 100),
        startAngle: start + (gap > 0 ? gap / 2 : 0),
        endAngle: end - (gap > 0 ? gap / 2 : 0),
      };
    });

    return { pieSlices: slices, totalStockUnits: total };
  }, [products]);

  // Determine active product item (hovered takes preview priority, otherwise selected)
  const activePieIndex = hoveredPieIndex !== null
    ? hoveredPieIndex
    : selectedProductId
      ? pieSlices.findIndex(p => p.id === selectedProductId)
      : null;

  const activeProductItem = activePieIndex !== null && pieSlices[activePieIndex]
    ? pieSlices[activePieIndex]
    : null;

  const selectedProduct = selectedProductId
    ? pieSlices.find(p => p.id === selectedProductId) || products.find(p => p.id === selectedProductId)
    : null;

  // ── Sales Trend Data Calculation (Connected to Selected Product) ──
  const salesChartData = useMemo(() => {
    const now = new Date();
    const points: {
      periodLabel: string;
      fullDate: string;
      dateKey: string;
      revenue: number;
      cost: number;
      profit: number;
      unitsSold: number;
      invoicesCount: number;
    }[] = [];

    if (timePeriod === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = getLocalDateKey(d);
        const dayName = i === 0 ? 'اليوم' : i === 1 ? 'أمس' : d.toLocaleDateString('ar-IQ', { weekday: 'short' });
        const label = `${dayName} ${d.getDate()}`;
        const fullDate = d.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        points.push({
          periodLabel: label,
          fullDate,
          dateKey: key,
          revenue: 0,
          cost: 0,
          profit: 0,
          unitsSold: 0,
          invoicesCount: 0
        });
      }
    } else if (timePeriod === 'weekly') {
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
        const label = i === 0 ? 'هذا الأسبوع' : i === 1 ? 'الأسبوع الماضي' : `قبل ${i} أسابيع`;
        points.push({
          periodLabel: label,
          fullDate: `أسبوع ${d.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' })}`,
          dateKey: `w-${i}`,
          revenue: 0,
          cost: 0,
          profit: 0,
          unitsSold: 0,
          invoicesCount: 0
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('ar-IQ', { month: 'short' });
        const fullDate = d.toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' });
        points.push({
          periodLabel: label,
          fullDate,
          dateKey: key,
          revenue: 0,
          cost: 0,
          profit: 0,
          unitsSold: 0,
          invoicesCount: 0
        });
      }
    }

    sales.forEach(sale => {
      const d = new Date(sale.createdAt || Date.now());
      const saleLocalKey = getLocalDateKey(d);
      const saleMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const msDiff = now.getTime() - d.getTime();
      const dayDiff = Math.floor(msDiff / 86400000);
      const weekDiff = Math.floor(dayDiff / 7);

      let targetPoint: typeof points[0] | undefined;
      if (timePeriod === 'daily') {
        targetPoint = points.find(p => p.dateKey === saleLocalKey);
      } else if (timePeriod === 'weekly') {
        if (weekDiff >= 0 && weekDiff <= 4) {
          targetPoint = points.find(p => p.dateKey === `w-${weekDiff}`);
        }
      } else {
        targetPoint = points.find(p => p.dateKey === saleMonthKey);
      }

      if (targetPoint) {
        // Filter items: if a product is selected, calculate ONLY for that product!
        const relevantItems = selectedProductId
          ? sale.items.filter(it => it.productId === selectedProductId)
          : sale.items;

        if (relevantItems.length > 0) {
          targetPoint.invoicesCount += 1;
          let saleRev = 0;
          let saleCost = 0;
          let saleQty = 0;

          relevantItems.forEach(item => {
            const qty = item.quantity || 0;
            const rev = item.subtotal || ((item.sellPrice || 0) * qty);
            const cost = (item.costPrice || 0) * (item.unitType === 'package' ? qty * (item.unitsPerPackage || 1) : qty);
            saleRev += rev;
            saleCost += cost;
            saleQty += qty;
          });

          targetPoint.revenue += saleRev;
          targetPoint.cost += saleCost;
          targetPoint.profit += (saleRev - saleCost);
          targetPoint.unitsSold += saleQty;
        }
      }
    });

    return points;
  }, [sales, timePeriod, selectedProductId]);

  // Overall period statistics
  const periodStats = useMemo(() => {
    return salesChartData.reduce((acc, p) => ({
      totalUnits: acc.totalUnits + p.unitsSold,
      totalRev: acc.totalRev + p.revenue,
      totalCost: acc.totalCost + p.cost,
      totalProf: acc.totalProf + p.profit,
      totalInvoices: acc.totalInvoices + p.invoicesCount
    }), { totalUnits: 0, totalRev: 0, totalCost: 0, totalProf: 0, totalInvoices: 0 });
  }, [salesChartData]);

  // Active period point on hover or click
  const activePeriodIndex = hoveredPeriodIndex !== null ? hoveredPeriodIndex : selectedPeriodIndex;
  const activePeriodPoint = activePeriodIndex !== null && salesChartData[activePeriodIndex]
    ? salesChartData[activePeriodIndex]
    : null;

  // ── SVG Geometry Calculations for Sales Chart ─────────────
  const svgSalesGeometry = useMemo(() => {
    const W = 520;
    const H = 220;
    const padL = 46;
    const padR = 20;
    const padT = 24;
    const padB = 34;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const yBase = padT + chartH;

    const count = salesChartData.length;
    const maxRev = Math.max(...salesChartData.map(p => p.revenue), 1000) * 1.18;
    const maxUnits = Math.max(...salesChartData.map(p => p.unitsSold), 5) * 1.25;

    const coords = salesChartData.map((pt, i) => {
      const x = count === 1 ? padL + chartW / 2 : padL + (i / (count - 1)) * chartW;
      const yRev = yBase - (pt.revenue / maxRev) * chartH;
      const yProf = yBase - (pt.profit / maxRev) * chartH;
      const barH = (pt.unitsSold / maxUnits) * (chartH * 0.72);
      const barY = yBase - barH;

      return {
        ...pt,
        index: i,
        x,
        yRev: Math.min(yBase, Math.max(padT, yRev)),
        yProf: Math.min(yBase, Math.max(padT, yProf)),
        barH: Math.max(0, barH),
        barY
      };
    });

    const revPts = coords.map(c => ({ x: c.x, y: c.yRev }));
    const profPts = coords.map(c => ({ x: c.x, y: c.yProf }));

    const revCurve = buildSmoothPath(revPts);
    const profCurve = buildSmoothPath(profPts);

    const firstX = coords[0]?.x || padL;
    const lastX = coords[coords.length - 1]?.x || (padL + chartW);

    const revArea = revCurve ? `${revCurve} L ${lastX} ${yBase} L ${firstX} ${yBase} Z` : '';
    const profArea = profCurve ? `${profCurve} L ${lastX} ${yBase} L ${firstX} ${yBase} Z` : '';

    const yTicks = [0, 0.33, 0.66, 1].map(frac => {
      const val = Math.round((maxRev * frac) / 1000) * 1000;
      const y = yBase - frac * chartH;
      let label = `${val.toLocaleString()}`;
      if (val >= 1000000) label = `${(val / 1000000).toFixed(1)}M`;
      else if (val >= 1000) label = `${Math.round(val / 1000)}k`;
      return { y, label };
    });

    return {
      W, H, padL, padR, padT, padB, chartW, chartH, yBase,
      coords, revCurve, profCurve, revArea, profArea, yTicks, maxRev, maxUnits
    };
  }, [salesChartData]);

  // Handler to toggle product selection
  const handleToggleProduct = (productId: string) => {
    setSelectedProductId(prev => (prev === productId ? null : productId));
    setSelectedPeriodIndex(null);
  };

  return (
    <div style={{ width: '100%', marginBottom: '0.5rem' }}>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── UNIFIED MASTER ANALYTICS CONTAINER (الجارتين متصلين) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div
        className="table-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid #E2E8F0',
          boxShadow: 'var(--clay-card-shadow)',
          background: '#FFFFFF',
          width: '100%'
        }}
      >

        {/* ── Master Panel Header: Connective Hub Bar ───────────── */}
        <div style={{
          padding: '1rem 1.35rem',
          background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
          borderBottom: '1.5px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}>
          {/* Main Title & Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(145deg, #3B82F6, #1D4ED8)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              flexShrink: 0
            }}>
              <FiLayers size={22} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>
                  مركز التحليلات المتكامل: المخزون والمبيعات
                </h3>

                {/* Connection Badge Indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.65rem',
                  borderRadius: 'var(--radius-pill)',
                  background: selectedProductId ? '#DCFCE7' : '#EFF6FF',
                  color: selectedProductId ? '#15803D' : '#2563EB',
                  border: `1.5px solid ${selectedProductId ? '#86EFAC' : '#BFDBFE'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}>
                  <FiLink size={12} />
                  {selectedProduct ? (
                    <>
                      <span>متصل بـ:</span>
                      <strong style={{ color: '#0F172A' }}>{selectedProduct.name}</strong>
                    </>
                  ) : (
                    <span>الجارتان متصلان تفاعلياً</span>
                  )}
                </div>
              </div>

              <p style={{ margin: '0.15rem 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                {selectedProduct ? (
                  <span style={{ color: '#15803D', fontWeight: 700 }}>
                    💡 يعرض جارت المبيعات الآن منحنى مبيعات وأرباح صنف «{selectedProduct.name}» حصراً
                  </span>
                ) : (
                  <span>
                    💡 انقر على أي منتج في مخطط الدونات باليمين لتصفية مخطط المبيعات باليسار فوراً
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Master Action Tools & Period Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {selectedProductId && (
              <button
                onClick={() => setSelectedProductId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: '#DC2626',
                  background: '#FEE2E2',
                  border: '1.5px solid #FECACA',
                  borderRadius: 'var(--radius-pill)',
                  padding: '0.3rem 0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <FiX size={13} />
                عرض كافة الأصناف
              </button>
            )}

            {/* Time Period Tabs */}
            <div style={{
              display: 'flex',
              background: '#FFFFFF',
              padding: '0.2rem',
              borderRadius: 'var(--radius-pill)',
              border: '1.5px solid #CBD5E1',
              gap: '0.2rem',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
            }}>
              {(['daily', 'weekly', 'monthly'] as TimePeriod[]).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setTimePeriod(t);
                    setSelectedPeriodIndex(null);
                  }}
                  style={{
                    background: timePeriod === t ? 'linear-gradient(145deg,#3B82F6,#2563EB)' : 'transparent',
                    color: timePeriod === t ? '#FFFFFF' : '#475569',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: timePeriod === t ? '0 2px 6px rgba(37,99,235,0.35)' : 'none',
                    transition: 'all 0.18s ease'
                  }}
                >
                  {t === 'daily' ? 'يومي (7 أيام)' : t === 'weekly' ? 'أسبوعي (5 أسابيع)' : 'شهري (6 أشهر)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Connected Dual-Chart Body Layout ─────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          width: '100%',
          position: 'relative'
        }}>

          {/* ────────────────────────────────────────────────────────── */}
          {/* ── Pane 1: Donut Distribution (توزيع المخزون) ─────────── */}
          {/* ────────────────────────────────────────────────────────── */}
          <div style={{
            padding: '1.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            borderLeft: '1.5px solid #F1F5F9',
            background: '#FFFFFF',
            minWidth: 0
          }}>
            {/* Sub-header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #F1F5F9',
              paddingBottom: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  background: '#EFF6FF',
                  color: '#2563EB',
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FiPieChart size={17} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>
                    1. توزيع الأصناف بالمخزن
                  </h4>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    المصدر التفاعلي للمبيعات
                  </p>
                </div>
              </div>

              {selectedProductId && (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#15803D',
                  background: '#DCFCE7',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px'
                }}>
                  محدد الآن ✓
                </span>
              )}
            </div>

            {/* Interactive Info Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.45rem 0.85rem',
              background: activeProductItem ? '#EFF6FF' : '#F8FAFC',
              borderRadius: 'var(--radius-pill)',
              border: `1.5px solid ${activeProductItem ? '#BFDBFE' : '#E2E8F0'}`,
              fontSize: '0.76rem',
              minHeight: '38px',
              transition: 'all 0.2s ease'
            }}>
              {activeProductItem ? (
                <>
                  <span style={{
                    fontWeight: 800,
                    color: '#0F172A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    <span style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: activeProductItem.color,
                      display: 'inline-block',
                      flexShrink: 0,
                      boxShadow: `0 0 8px ${activeProductItem.color}80`
                    }} />
                    {activeProductItem.name}
                  </span>
                  <span style={{ fontWeight: 800, color: '#2563EB', flexShrink: 0 }}>
                    {activeProductItem.value.toLocaleString()} قطعة
                    <span style={{ marginRight: '6px', color: '#10B981', fontWeight: 800 }}>
                      ({activeProductItem.percentage}%)
                    </span>
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--muted)', fontSize: '0.74rem', fontWeight: 600 }}>
                  💡 انقر على أي شريحة لتصفية الجارت الجانبي فوراً
                </span>
              )}
            </div>

            {/* Donut Chart Canvas */}
            <div style={{
              width: '100%',
              height: '240px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {pieSlices.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  لا توجد منتجات مسجلة برصيد متوفر
                </div>
              ) : (
                <>
                  <svg
                    viewBox="0 0 320 320"
                    style={{
                      width: '100%',
                      height: '100%',
                      maxHeight: '240px',
                      overflow: 'visible'
                    }}
                  >
                    <defs>
                      <filter id="activeSliceShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.32" />
                      </filter>
                      <filter id="centerBadgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#94A3B8" floodOpacity="0.25" />
                      </filter>
                    </defs>

                    {pieSlices.map((slice, i) => {
                      const isSliceActive = activePieIndex === i;
                      const rIn = isSliceActive ? 72 : 78;
                      const rOut = isSliceActive ? 138 : 124;
                      const pathD = describeDonutSlice(160, 160, rIn, rOut, slice.startAngle, slice.endAngle);

                      return (
                        <g key={slice.id} style={{ cursor: 'pointer' }}>
                          <path
                            d={pathD}
                            fill={slice.color}
                            stroke="#FFFFFF"
                            strokeWidth={isSliceActive ? 3.5 : 2}
                            filter={isSliceActive ? 'url(#activeSliceShadow)' : undefined}
                            opacity={activePieIndex !== null && !isSliceActive ? 0.38 : 1}
                            onMouseEnter={() => setHoveredPieIndex(i)}
                            onMouseLeave={() => setHoveredPieIndex(null)}
                            onClick={() => handleToggleProduct(slice.id)}
                            style={{
                              transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                              transformOrigin: '160px 160px'
                            }}
                          />
                        </g>
                      );
                    })}

                    <circle
                      cx="160"
                      cy="160"
                      r="68"
                      fill="#FFFFFF"
                      stroke="#E2E8F0"
                      strokeWidth="2"
                      filter="url(#centerBadgeShadow)"
                    />
                  </svg>

                  {/* Center Badge Information Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    textAlign: 'center',
                    padding: '0.4rem',
                    zIndex: 2
                  }}>
                    {activeProductItem ? (
                      <>
                        <span style={{
                          fontSize: '0.68rem',
                          color: '#64748B',
                          fontWeight: 700,
                          maxWidth: 96,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {activeProductItem.name}
                        </span>
                        <span style={{
                          fontSize: '1.35rem',
                          fontWeight: 900,
                          color: activeProductItem.color,
                          lineHeight: 1.1,
                          margin: '0.1rem 0'
                        }}>
                          {activeProductItem.value.toLocaleString()}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          color: '#10B981',
                          fontWeight: 800,
                          background: '#DCFCE7',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '10px'
                        }}>
                          {activeProductItem.percentage}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700 }}>
                          إجمالي المخزون
                        </span>
                        <span style={{
                          fontSize: '1.35rem',
                          fontWeight: 900,
                          color: '#0F172A',
                          lineHeight: 1.1,
                          margin: '0.1rem 0'
                        }}>
                          {totalStockUnits.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.66rem', color: '#2563EB', fontWeight: 700 }}>
                          قطعة متوفرة
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Selected Product Action Card */}
            {activeProductItem && (
              <div style={{
                background: '#F8FAFC',
                border: `1.5px solid ${activeProductItem.color}50`,
                borderRadius: 'var(--radius-lg)',
                padding: '0.8rem',
                animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.45rem',
                  flexWrap: 'wrap',
                  gap: '0.35rem'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: activeProductItem.color,
                      display: 'inline-block'
                    }} />
                    {activeProductItem.name}
                  </h4>

                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '20px',
                    background: activeProductItem.value <= activeProductItem.minStock ? '#FEE2E2' : '#DCFCE7',
                    color: activeProductItem.value <= activeProductItem.minStock ? '#B91C1C' : '#15803D'
                  }}>
                    {activeProductItem.value <= 0 ? 'نفد الرصيد' : activeProductItem.value <= activeProductItem.minStock ? 'رصيد منخفض' : 'متوفر'}
                  </span>
                </div>

                {/* 4 Metrics */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.35rem',
                  textAlign: 'center'
                }}>
                  {[
                    { label: 'الرصيد', val: `${activeProductItem.value} ق`, bg: '#EFF6FF', color: '#2563EB' },
                    { label: 'سعر البيع', val: activeProductItem.sellPrice.toLocaleString(), bg: '#F0FDF4', color: '#16A34A' },
                    { label: 'كلفة الشراء', val: (activeProductItem.costPrice * activeProductItem.value).toLocaleString(), bg: '#EEF2FF', color: '#4F46E5' },
                    { label: 'القيمة البيعية', val: (activeProductItem.sellPrice * activeProductItem.value).toLocaleString(), bg: '#E0F2FE', color: '#0284C7' }
                  ].map(({ label, val, bg, color }) => (
                    <div key={label} style={{ background: bg, padding: '0.35rem 0.2rem', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.58rem', color, fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 800, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.55rem' }}>
                  <button
                    onClick={() => handleToggleProduct(activeProductItem.id)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: selectedProductId === activeProductItem.id ? '#DC2626' : '#2563EB',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {selectedProductId === activeProductItem.id ? '✕ إلغاء تصفية الجارت' : '🔗 تصفية جارت المبيعات بهذا الصنف'}
                  </button>

                  <button
                    onClick={() => navigate(`/sell?productId=${activeProductItem.id}`)}
                    className="btn-primary-custom"
                    style={{
                      fontSize: '0.74rem',
                      padding: '0.25rem 0.7rem',
                      background: '#16A34A',
                      borderColor: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <FiShoppingBag size={12} />
                    بيع الصنف
                  </button>
                </div>
              </div>
            )}

            {/* Clickable Legend Pills */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.35rem',
                maxHeight: '80px',
                overflowY: 'auto'
              }}
              className="no-scrollbar"
            >
              {pieSlices.slice(0, 10).map((slice, i) => {
                const isSelected = selectedProductId === slice.id;
                return (
                  <button
                    key={slice.id}
                    onClick={() => handleToggleProduct(slice.id)}
                    onMouseEnter={() => setHoveredPieIndex(i)}
                    onMouseLeave={() => setHoveredPieIndex(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.72rem',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-pill)',
                      background: isSelected ? `${slice.color}25` : '#F8FAFC',
                      border: `1.5px solid ${isSelected ? slice.color : '#E2E8F0'}`,
                      color: isSelected ? slice.color : 'var(--text-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: slice.color,
                      display: 'inline-block',
                      flexShrink: 0
                    }} />
                    <span>{slice.name}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.75 }}>({slice.value})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* ── Pane 2: Connected Sales Chart (مبيعات المخزن عبر الزمن) ─ */}
          {/* ────────────────────────────────────────────────────────── */}
          <div style={{
            padding: '1.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            background: '#FFFFFF',
            minWidth: 0
          }}>
            {/* Sub-header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #F1F5F9',
              paddingBottom: '0.65rem',
              flexWrap: 'wrap',
              gap: '0.4rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  background: '#F0FDF4',
                  color: '#16A34A',
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FiTrendingUp size={17} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>
                    2. حركة المبيعات والأرباح
                  </h4>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {selectedProduct ? (
                      <span style={{ color: '#2563EB', fontWeight: 700 }}>
                        مبيعات صنف: «{selectedProduct.name}»
                      </span>
                    ) : (
                      'مبيعات كافة أصناف المخزن'
                    )}
                  </p>
                </div>
              </div>

              {/* View mode filter */}
              <div style={{ display: 'flex', gap: '0.2rem' }}>
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'revenue', label: 'المبيعات' },
                  { id: 'profit', label: 'الأرباح' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setViewMode(m.id as ChartViewMode)}
                    style={{
                      background: viewMode === m.id ? '#EFF6FF' : 'transparent',
                      color: viewMode === m.id ? '#2563EB' : '#64748B',
                      border: `1px solid ${viewMode === m.id ? '#BFDBFE' : '#E2E8F0'}`,
                      borderRadius: 'var(--radius-pill)',
                      padding: '0.15rem 0.5rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Info Strip for Hovered / Selected Period */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.45rem 0.85rem',
              background: activePeriodPoint ? '#EFF6FF' : '#F8FAFC',
              borderRadius: 'var(--radius-pill)',
              border: `1.5px solid ${activePeriodPoint ? '#BFDBFE' : '#E2E8F0'}`,
              fontSize: '0.76rem',
              minHeight: '38px',
              transition: 'all 0.2s ease',
              flexWrap: 'wrap',
              gap: '0.4rem'
            }}>
              {activePeriodPoint ? (
                <>
                  <span style={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FiCalendar size={13} color="#2563EB" />
                    {activePeriodPoint.fullDate}
                    {activePeriodPoint.invoicesCount > 0 && (
                      <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
                        ({activePeriodPoint.invoicesCount} فاتورة)
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontWeight: 800, flexWrap: 'wrap' }}>
                    <span style={{ color: '#2563EB' }}>
                      المبيعات: {activePeriodPoint.revenue.toLocaleString()} {settings.currency}
                    </span>
                    <span style={{ color: '#16A34A' }}>
                      الأرباح: {activePeriodPoint.profit.toLocaleString()} {settings.currency}
                    </span>
                    <span style={{ color: '#7C3AED' }}>
                      القطع: {activePeriodPoint.unitsSold}
                    </span>
                  </div>
                </>
              ) : (
                <span style={{ color: 'var(--muted)', fontSize: '0.74rem', fontWeight: 600 }}>
                  💡 مرر الفأرة على أي يوم أو عمود في المخطط لعرض أرقامه
                </span>
              )}
            </div>

            {/* Pure Interactive SVG Sales Area Chart */}
            <div style={{
              width: '100%',
              height: '240px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg
                viewBox={`0 0 ${svgSalesGeometry.W} ${svgSalesGeometry.H}`}
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: '240px',
                  overflow: 'visible'
                }}
              >
                <defs>
                  <linearGradient id="connectedRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.38" />
                    <stop offset="90%" stopColor="#2563EB" stopOpacity="0.0" />
                  </linearGradient>

                  <linearGradient id="connectedProfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                    <stop offset="90%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>

                  <filter id="connectedPointGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
                  </filter>
                </defs>

                {/* Horizontal Grid lines & Y-axis labels */}
                {svgSalesGeometry.yTicks.map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={svgSalesGeometry.padL}
                      y1={tick.y}
                      x2={svgSalesGeometry.W - svgSalesGeometry.padR}
                      y2={tick.y}
                      stroke="#E2E8F0"
                      strokeDasharray={i === 0 ? undefined : "3 3"}
                      strokeWidth="1"
                    />
                    <text
                      x={svgSalesGeometry.padL - 6}
                      y={tick.y + 3}
                      textAnchor="end"
                      fontSize="9.5"
                      fill="#94A3B8"
                      fontFamily="Cairo, sans-serif"
                      fontWeight="600"
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}

                {/* Background Units Sold Volume Bars */}
                {svgSalesGeometry.coords.map((col, i) => {
                  const isActive = activePeriodIndex === i;
                  const barWidth = Math.max(14, Math.min(32, svgSalesGeometry.chartW / (svgSalesGeometry.coords.length * 2)));
                  return (
                    <g key={`bar-${i}`}>
                      {isActive && (
                        <rect
                          x={col.x - barWidth}
                          y={svgSalesGeometry.padT}
                          width={barWidth * 2}
                          height={svgSalesGeometry.chartH}
                          fill="#EFF6FF"
                          rx="6"
                          opacity="0.85"
                        />
                      )}
                      {col.unitsSold > 0 && (
                        <rect
                          x={col.x - barWidth / 2}
                          y={col.barY}
                          width={barWidth}
                          height={col.barH}
                          rx="4"
                          fill="#A78BFA"
                          opacity={isActive ? 0.65 : 0.28}
                          style={{ transition: 'all 0.2s ease' }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Area Fills */}
                {viewMode !== 'units' && (
                  <>
                    <path
                      d={svgSalesGeometry.revArea}
                      fill="url(#connectedRevGrad)"
                      style={{ transition: 'all 0.25s ease' }}
                    />
                    <path
                      d={svgSalesGeometry.profArea}
                      fill="url(#connectedProfGrad)"
                      style={{ transition: 'all 0.25s ease' }}
                    />
                    <path
                      d={svgSalesGeometry.revCurve}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={svgSalesGeometry.profCurve}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}

                {/* Active dashed vertical indicator beam */}
                {activePeriodIndex !== null && svgSalesGeometry.coords[activePeriodIndex] && (
                  <line
                    x1={svgSalesGeometry.coords[activePeriodIndex].x}
                    y1={svgSalesGeometry.padT}
                    x2={svgSalesGeometry.coords[activePeriodIndex].x}
                    y2={svgSalesGeometry.yBase}
                    stroke="#2563EB"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                )}

                {/* Interactive Dots on Data Points */}
                {svgSalesGeometry.coords.map((col, i) => {
                  const isActive = activePeriodIndex === i;
                  return (
                    <g key={`dots-${i}`}>
                      <circle
                        cx={col.x}
                        cy={col.yRev}
                        r={isActive ? 6 : 4}
                        fill="#2563EB"
                        stroke="#FFFFFF"
                        strokeWidth={isActive ? 2.5 : 2}
                        filter={isActive ? 'url(#connectedPointGlow)' : undefined}
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      <circle
                        cx={col.x}
                        cy={col.yProf}
                        r={isActive ? 5.5 : 3.5}
                        fill="#10B981"
                        stroke="#FFFFFF"
                        strokeWidth={isActive ? 2 : 1.5}
                        style={{ transition: 'all 0.2s ease' }}
                      />
                    </g>
                  );
                })}

                {/* X-axis Labels */}
                {svgSalesGeometry.coords.map((col, i) => {
                  const isActive = activePeriodIndex === i;
                  return (
                    <text
                      key={`label-${i}`}
                      x={col.x}
                      y={svgSalesGeometry.yBase + 16}
                      textAnchor="middle"
                      fontSize={isActive ? "10.5" : "9.5"}
                      fill={isActive ? "#1E40AF" : "#64748B"}
                      fontWeight={isActive ? "800" : "600"}
                      fontFamily="Cairo, sans-serif"
                      style={{ transition: 'all 0.15s ease' }}
                    >
                      {col.periodLabel}
                    </text>
                  );
                })}

                {/* Transparent Interactive Column Hit-Zones */}
                {svgSalesGeometry.coords.map((col, i) => {
                  const colWidth = svgSalesGeometry.chartW / svgSalesGeometry.coords.length;
                  return (
                    <rect
                      key={`hit-${i}`}
                      x={col.x - colWidth / 2}
                      y={svgSalesGeometry.padT}
                      width={colWidth}
                      height={svgSalesGeometry.chartH + 30}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPeriodIndex(i)}
                      onMouseLeave={() => setHoveredPeriodIndex(null)}
                      onClick={() => setSelectedPeriodIndex(prev => prev === i ? null : i)}
                    />
                  );
                })}
              </svg>
            </div>

            {/* Legend & Summary Info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.72rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
              borderTop: '1px solid #F1F5F9',
              paddingTop: '0.55rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#1E40AF' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                  المبيعات ({settings.currency})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#15803D' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  الأرباح ({settings.currency})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#7C3AED' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#A78BFA', display: 'inline-block' }} />
                  القطع المباعة
                </div>
              </div>

              {selectedProductId && (
                <button
                  onClick={() => setSelectedProductId(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: '#2563EB',
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.15rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <FiRefreshCw size={10} />
                  إعادة ضبط الكل
                </button>
              )}
            </div>

            {/* KPI Summary Strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.45rem',
              textAlign: 'center'
            }}>
              <div style={{
                background: '#EFF6FF',
                padding: '0.5rem 0.35rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #DBEAFE'
              }}>
                <div style={{ fontSize: '0.64rem', color: '#2563EB', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <FiDollarSign size={11} />
                  مبيعات الفترة
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1E40AF', marginTop: '0.1rem' }}>
                  {periodStats.totalRev.toLocaleString()} {settings.currency}
                </div>
              </div>

              <div style={{
                background: '#F0FDF4',
                padding: '0.5rem 0.35rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #DCFCE7'
              }}>
                <div style={{ fontSize: '0.64rem', color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <FiPackage size={11} />
                  القطع المباعة
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#15803D', marginTop: '0.1rem' }}>
                  {periodStats.totalUnits.toLocaleString()} قطعة
                </div>
              </div>

              <div style={{
                background: '#FAF5FF',
                padding: '0.5rem 0.35rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #F3E8FF'
              }}>
                <div style={{ fontSize: '0.64rem', color: '#7E22CE', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <FiLayers size={11} />
                  صافي الأرباح
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#6B21A8', marginTop: '0.1rem' }}>
                  {periodStats.totalProf.toLocaleString()} {settings.currency}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
