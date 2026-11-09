import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FiSearch, FiPrinter, FiDownload, FiDollarSign, FiTrendingUp, FiShoppingBag,
  FiX, FiMove, FiEdit2, FiTrash2, FiCheck, FiAlertTriangle, FiUser, FiFileText,
  FiPlus, FiMinus, FiRefreshCw, FiPackage, FiCreditCard, FiClock, FiCheckCircle,
  FiArchive, FiRotateCcw, FiSliders, FiCalendar
} from 'react-icons/fi';
import { storeService } from '../services/storeService';
import SaleInvoice from '../components/common/SaleInvoice';
import type { SaleRecord, SimpleProduct, Expense } from '../types';
import { EXPENSE_CATEGORIES as EXPENSE_CATS } from '../types';

// ── Full-Featured Invoice Edit Modal ──────────────────────
interface EditItemState {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  sellPrice: number;
  unitType: 'piece' | 'package';
  unitName: string;
  unitsPerPackage: number;
  hasPackageUnit: boolean;
  packageUnitName?: string;
  packageSellPrice?: number;
  pieceSellPrice: number;
}

interface EditModalProps {
  sale: SaleRecord;
  currency: string;
  onSave: (id: string, data: {
    customerName: string;
    notes: string;
    items: {
      productId: string;
      quantity: number;
      sellPrice: number;
      unitType: 'piece' | 'package';
    }[];
  }) => void;
  onClose: () => void;
}

function EditSaleModal({ sale, currency, onSave, onClose }: EditModalProps) {
  const [allProducts] = useState<SimpleProduct[]>(() => storeService.getProducts());
  const [customerName, setCustomerName] = useState(sale.customerName || 'عميل نقدي');
  const [notes, setNotes] = useState(sale.notes || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Initialize items from the existing invoice
  const [items, setItems] = useState<EditItemState[]>(() => {
    return sale.items.map(item => {
      const prod = allProducts.find(p => p.id === item.productId);
      const hasPkg = !!(prod?.hasPackageUnit || (prod?.unitsPerPackage && prod.unitsPerPackage > 1));
      const unitsPkg = prod?.unitsPerPackage || item.unitsPerPackage || 1;
      return {
        productId: item.productId,
        productName: item.productName || prod?.name || 'منتج',
        barcode: item.barcode || prod?.barcode,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        unitType: item.unitType || 'piece',
        unitName: item.unitName || (item.unitType === 'package' ? (prod?.packageUnitName || 'شليف') : 'قطعة'),
        unitsPerPackage: unitsPkg,
        hasPackageUnit: hasPkg,
        packageUnitName: prod?.packageUnitName || 'شليف',
        packageSellPrice: prod?.packageSellPrice || (prod ? prod.sellPrice * unitsPkg : item.sellPrice),
        pieceSellPrice: prod?.sellPrice || item.sellPrice,
      };
    });
  });

  // Calculate available pieces in warehouse + restored pieces from this original invoice
  const getProductPoolPieces = (productId: string) => {
    const prod = allProducts.find(p => p.id === productId);
    if (!prod) return 0;
    const origItem = sale.items.find(i => i.productId === productId);
    // Use piecesCount (exact pieces deducted at sale time) for accuracy.
    // Fallback to unitType calculation only for old records without piecesCount.
    const origPieces = origItem
      ? (origItem.piecesCount != null
          ? origItem.piecesCount
          : (origItem.unitType === 'package'
              ? origItem.quantity * (origItem.unitsPerPackage || 1)
              : origItem.quantity))
      : 0;
    return prod.stock + origPieces;
  };

  const getAvailablePiecesForItem = (productId: string, currentItemIndex?: number) => {
    const pool = getProductPoolPieces(productId);
    const usedInOtherRows = items
      .filter((_, idx) => idx !== currentItemIndex && _.productId === productId)
      .reduce((sum, it) => sum + (it.unitType === 'package' ? it.quantity * it.unitsPerPackage : it.quantity), 0);
    return Math.max(0, pool - usedInOtherRows);
  };

  // Adjust item quantity
  const updateQuantity = (index: number, newQty: number) => {
    setErrorMsg('');
    if (newQty <= 0) return;
    const item = items[index];
    const availPieces = getAvailablePiecesForItem(item.productId, index);
    const neededPieces = item.unitType === 'package' ? newQty * item.unitsPerPackage : newQty;

    if (neededPieces > availPieces) {
      const maxUnits = item.unitType === 'package' ? Math.floor(availPieces / item.unitsPerPackage) : availPieces;
      setErrorMsg(`الكمية المتاحة في المخزن لهذا المنتج هي (${maxUnits} ${item.unitName}) فقط!`);
      return;
    }

    setItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: newQty } : it));
  };

  // Toggle unit (piece vs package)
  const toggleUnit = (index: number) => {
    setErrorMsg('');
    const item = items[index];
    if (!item.hasPackageUnit) return;

    const targetUnit: 'piece' | 'package' = item.unitType === 'piece' ? 'package' : 'piece';
    const availPieces = getAvailablePiecesForItem(item.productId, index);

    if (targetUnit === 'package') {
      const newQty = 1;
      if (item.unitsPerPackage > availPieces) {
        setErrorMsg(`المخزون المتوفر (${availPieces} قطعة) لا يكفي لـ 1 ${item.packageUnitName || 'شليف'} (${item.unitsPerPackage} قطعة)!`);
        return;
      }
      setItems(prev => prev.map((it, i) => i === index ? {
        ...it,
        unitType: 'package',
        unitName: it.packageUnitName || 'شليف',
        sellPrice: it.packageSellPrice || (it.pieceSellPrice * it.unitsPerPackage),
        quantity: newQty,
      } : it));
    } else {
      const newQty = item.quantity * item.unitsPerPackage;
      setItems(prev => prev.map((it, i) => i === index ? {
        ...it,
        unitType: 'piece',
        unitName: 'قطعة',
        sellPrice: it.pieceSellPrice,
        quantity: Math.min(newQty, availPieces),
      } : it));
    }
  };

  // Update sell price
  const updatePrice = (index: number, newPrice: number) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, sellPrice: Math.max(0, newPrice) } : it));
  };

  // Remove item
  const removeItem = (index: number) => {
    setErrorMsg('');
    if (items.length <= 1) {
      setErrorMsg('يجب أن تحتوي الفاتورة على منتج واحد على الأقل. لإلغاء الفاتورة بالكامل، يرجى استخدام زر "حذف الفاتورة".');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
    if (replacingIndex === index) setReplacingIndex(null);
  };

  // Add / Replace product from warehouse
  const handleSelectProduct = (product: SimpleProduct) => {
    setErrorMsg('');

    // If in replace mode
    if (replacingIndex !== null && items[replacingIndex]) {
      const pool = getProductPoolPieces(product.id);
      // check other rows usage
      const usedInOtherRows = items
        .filter((_, idx) => idx !== replacingIndex && _.productId === product.id)
        .reduce((sum, it) => sum + (it.unitType === 'package' ? it.quantity * it.unitsPerPackage : it.quantity), 0);
      const avail = Math.max(0, pool - usedInOtherRows);

      if (avail <= 0) {
        setErrorMsg(`المنتج "${product.name}" نفد من المخزون ولا يمكن اختياره كبديل.`);
        return;
      }

      const hasPkg = !!(product.hasPackageUnit || (product.unitsPerPackage && product.unitsPerPackage > 1));
      const unitsPkg = product.unitsPerPackage || 1;

      setItems(prev => prev.map((it, i) => i === replacingIndex ? {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        quantity: 1,
        sellPrice: product.sellPrice,
        unitType: 'piece',
        unitName: 'قطعة',
        unitsPerPackage: unitsPkg,
        hasPackageUnit: hasPkg,
        packageUnitName: product.packageUnitName || 'شليف',
        packageSellPrice: product.packageSellPrice || (product.sellPrice * unitsPkg),
        pieceSellPrice: product.sellPrice,
      } : it));

      setReplacingIndex(null);
      setSearchProductQuery('');
      return;
    }

    // Normal addition
    const existingIdx = items.findIndex(it => it.productId === product.id);
    if (existingIdx !== -1) {
      updateQuantity(existingIdx, items[existingIdx].quantity + 1);
      setSearchProductQuery('');
      return;
    }

    const avail = getAvailablePiecesForItem(product.id);
    if (avail <= 0) {
      setErrorMsg(`المنتج "${product.name}" غير متوفر بالمخزن حالياً.`);
      return;
    }

    const hasPkg = !!(product.hasPackageUnit || (product.unitsPerPackage && product.unitsPerPackage > 1));
    const unitsPkg = product.unitsPerPackage || 1;

    setItems(prev => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        quantity: 1,
        sellPrice: product.sellPrice,
        unitType: 'piece',
        unitName: 'قطعة',
        unitsPerPackage: unitsPkg,
        hasPackageUnit: hasPkg,
        packageUnitName: product.packageUnitName || 'شليف',
        packageSellPrice: product.packageSellPrice || (product.sellPrice * unitsPkg),
        pieceSellPrice: product.sellPrice,
      },
    ]);
    setSearchProductQuery('');
  };

  // Calculations
  const newTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.sellPrice * it.quantity), 0);
  }, [items]);

  const totalPieces = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.unitType === 'package' ? it.quantity * it.unitsPerPackage : it.quantity), 0);
  }, [items]);

  const diffAmount = newTotal - sale.totalAmount;

  // Search filtered products
  const searchResults = useMemo(() => {
    if (!searchProductQuery.trim()) return [];
    const q = searchProductQuery.toLowerCase();
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [allProducts, searchProductQuery]);

  // Submit
  const handleSave = () => {
    setErrorMsg('');
    if (items.length === 0) {
      setErrorMsg('يجب أن تحتوي الفاتورة على منتج واحد على الأقل!');
      return;
    }
    for (const it of items) {
      if (it.quantity <= 0) {
        setErrorMsg(`يرجى تحديد كمية صحيحة للمنتج "${it.productName}"`);
        return;
      }
    }

    onSave(sale.id, {
      customerName,
      notes,
      items: items.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        sellPrice: it.sellPrice,
        unitType: it.unitType,
      })),
    });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3000, direction: 'rtl',
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 24px 60px rgba(15,23,42,0.32), inset 2px 2px 4px rgba(255,255,255,0.95)',
          width: '95%', maxWidth: '880px',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalScale 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* ── Fixed Header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.4rem',
          background: 'linear-gradient(135deg,#EFF6FF,#F8FAFC)',
          borderBottom: '1.5px solid #E2E8F0',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              background: '#DBEAFE', color: '#1D4ED8',
              borderRadius: '8px', padding: '0.4rem', display: 'flex'
            }}>
              <FiEdit2 size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                تعديل طلب البيع — {sale.invoiceNumber}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                تاريخ الإنشاء: {new Date(sale.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '0.3rem', borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* ── Scrollable Body without scrollbars ── */}
        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
          }}
        >
          {/* Error Banner */}
          {errorMsg && (
            <div style={{
              background: '#FEF2F2', border: '1.5px solid #FECACA',
              borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem',
              color: '#B91C1C', fontWeight: 700, fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <FiAlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Top Form: Customer & Notes */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.85rem', background: '#F8FAFC', padding: '1rem',
            borderRadius: 'var(--radius-lg)', border: '1px solid #E2E8F0',
          }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', color: '#334155' }}>
                <FiUser size={14} style={{ color: '#2563EB' }} /> اسم العميل
              </label>
              <input
                type="text"
                className="form-control-custom"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="اسم العميل (عميل نقدي)"
                style={{ background: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', color: '#334155' }}>
                <FiFileText size={14} style={{ color: '#2563EB' }} /> ملاحظات الفاتورة
              </label>
              <input
                type="text"
                className="form-control-custom"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="ملاحظات اختيارية..."
                style={{ background: '#fff' }}
              />
            </div>
          </div>

          {/* ── Search & Add / Replace Section ── */}
          <div style={{
            background: replacingIndex !== null ? '#FFFBEB' : '#F1F5F9',
            border: replacingIndex !== null ? '1.5px dashed #F59E0B' : '1px solid #E2E8F0',
            borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem',
            transition: 'all 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.88rem', color: replacingIndex !== null ? '#B45309' : '#1E293B' }}>
                {replacingIndex !== null ? (
                  <>
                    <FiRefreshCw size={15} className="spin" />
                    <span>وضع الاستبدال: اختر منتجاً بديلاً لـ "{items[replacingIndex]?.productName}"</span>
                  </>
                ) : (
                  <>
                    <FiPlus size={15} style={{ color: '#16A34A' }} />
                    <span>إضافة منتج من المخزن إلى الفاتورة أو استبداله:</span>
                  </>
                )}
              </div>
              {replacingIndex !== null && (
                <button
                  type="button"
                  onClick={() => setReplacingIndex(null)}
                  style={{
                    background: '#FEE2E2', color: '#DC2626', border: 'none',
                    borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem',
                    fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  إلغاء وضع الاستبدال ✕
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <FiSearch style={{ position: 'absolute', right: '0.8rem', color: '#94A3B8' }} />
                <input
                  type="text"
                  className="form-control-custom"
                  value={searchProductQuery}
                  onChange={e => setSearchProductQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الباركود لإضافة أو استبدال منتج..."
                  style={{
                    paddingRight: '2.4rem',
                    background: '#fff',
                    borderColor: replacingIndex !== null ? '#F59E0B' : undefined,
                  }}
                />
                {searchProductQuery && (
                  <button
                    onClick={() => setSearchProductQuery('')}
                    style={{ position: 'absolute', left: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                  >
                    <FiX size={15} />
                  </button>
                )}
              </div>

              {/* Search dropdown cards */}
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '105%', left: 0, right: 0,
                  background: '#fff', borderRadius: 'var(--radius-md)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  border: '1px solid #CBD5E1', zIndex: 10,
                  maxHeight: '230px', overflowY: 'auto',
                }}>
                  {searchResults.map(prod => {
                    const avail = getProductPoolPieces(prod.id);
                    const isOut = avail <= 0;
                    return (
                      <div
                        key={prod.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.6rem 0.9rem', borderBottom: '1px solid #F1F5F9',
                          background: isOut ? '#F8FAFC' : '#fff',
                          opacity: isOut ? 0.6 : 1,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>
                            {prod.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B', display: 'flex', gap: '0.6rem' }}>
                            {prod.barcode && <span>🏷️ {prod.barcode}</span>}
                            <span>📦 المتاح: <strong>{avail}</strong> قطعة</span>
                            <span>💰 {prod.sellPrice.toLocaleString()} {currency}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isOut}
                          onClick={() => handleSelectProduct(prod)}
                          style={{
                            background: isOut ? '#E2E8F0' : (replacingIndex !== null ? '#F59E0B' : '#2563EB'),
                            color: '#fff', border: 'none', borderRadius: '6px',
                            padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: 800,
                            cursor: isOut ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                          }}
                        >
                          {replacingIndex !== null ? <FiRefreshCw size={12} /> : <FiPlus size={12} />}
                          {replacingIndex !== null ? 'استبدل به' : 'إضافة'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Invoice Items Table ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FiShoppingBag style={{ color: '#2563EB' }} />
                <span>منتجات الفاتورة ({items.length} أصناف):</span>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                يمكنك زيادة/إنقاص الكمية، تعديل السعر، تبديل الوحدة، أو استبدال المنتج
              </span>
            </div>

            <div style={{
              overflowX: 'auto', border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius-lg)', background: '#fff',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 800 }}>
                    <th style={{ padding: '0.7rem 0.8rem' }}>#</th>
                    <th style={{ padding: '0.7rem 0.8rem' }}>المنتج</th>
                    <th style={{ padding: '0.7rem 0.8rem' }}>الوحدة</th>
                    <th style={{ padding: '0.7rem 0.8rem' }}>سعر البيع</th>
                    <th style={{ padding: '0.7rem 0.8rem' }}>الكمية</th>
                    <th style={{ padding: '0.7rem 0.8rem' }}>الإجمالي</th>
                    <th style={{ padding: '0.7rem 0.8rem', textAlign: 'center' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const lineSubtotal = item.quantity * item.sellPrice;
                    const availPieces = getAvailablePiecesForItem(item.productId, idx);
                    const remainingPieces = availPieces - (item.unitType === 'package' ? item.quantity * item.unitsPerPackage : item.quantity);
                    const isSelectedForReplace = replacingIndex === idx;

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: isSelectedForReplace ? '#FFFBEB' : (idx % 2 === 0 ? '#FFFFFF' : '#FBFDFF'),
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Index */}
                        <td style={{ padding: '0.7rem 0.8rem', color: '#94A3B8', fontWeight: 700 }}>
                          {idx + 1}
                        </td>

                        {/* Product Name & Barcode */}
                        <td style={{ padding: '0.7rem 0.8rem' }}>
                          <div style={{ fontWeight: 800, color: '#0F172A' }}>{item.productName}</div>
                          {item.barcode && (
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{item.barcode}</div>
                          )}
                        </td>

                        {/* Unit selector */}
                        <td style={{ padding: '0.7rem 0.8rem' }}>
                          {item.hasPackageUnit ? (
                            <button
                              type="button"
                              onClick={() => toggleUnit(idx)}
                              title="انقر للتبديل بين القطعة والتعبئة"
                              style={{
                                background: item.unitType === 'package' ? '#EEF2FF' : '#F1F5F9',
                                color: item.unitType === 'package' ? '#4F46E5' : '#334155',
                                border: '1px solid',
                                borderColor: item.unitType === 'package' ? '#C7D2FE' : '#CBD5E1',
                                borderRadius: '6px', padding: '0.25rem 0.5rem',
                                fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                fontFamily: 'inherit',
                              }}
                            >
                              <FiPackage size={12} />
                              {item.unitName}
                              <span style={{ fontSize: '0.68rem', color: '#6366F1' }}>⇆</span>
                            </button>
                          ) : (
                            <span style={{
                              background: '#F1F5F9', color: '#475569',
                              borderRadius: '6px', padding: '0.2rem 0.5rem',
                              fontSize: '0.78rem', fontWeight: 700,
                            }}>
                              قطعة
                            </span>
                          )}
                        </td>

                        {/* Sell Price (editable) */}
                        <td style={{ padding: '0.7rem 0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <input
                              type="number"
                              className="form-control-custom"
                              value={item.sellPrice}
                              onChange={e => updatePrice(idx, parseFloat(e.target.value) || 0)}
                              style={{ width: '85px', padding: '0.3rem 0.4rem', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{currency}</span>
                          </div>
                        </td>

                        {/* Quantity with +/- and stock note */}
                        <td style={{ padding: '0.7rem 0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) updateQuantity(idx, item.quantity - 1);
                              }}
                              disabled={item.quantity <= 1}
                              style={{
                                width: '26px', height: '26px', borderRadius: '6px',
                                border: '1px solid #CBD5E1', background: item.quantity <= 1 ? '#F1F5F9' : '#F8FAFC',
                                cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: item.quantity <= 1 ? '#CBD5E1' : '#EF4444',
                                opacity: item.quantity <= 1 ? 0.5 : 1,
                              }}
                            >
                              <FiMinus size={12} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => updateQuantity(idx, parseInt(e.target.value, 10) || 1)}
                              className="form-control-custom"
                              style={{ width: '54px', padding: '0.3rem 0.2rem', textAlign: 'center', fontWeight: 800, fontSize: '0.88rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, item.quantity + 1)}
                              style={{
                                width: '26px', height: '26px', borderRadius: '6px',
                                border: '1px solid #CBD5E1', background: '#F8FAFC',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#334155',
                              }}
                            >
                              <FiPlus size={12} />
                            </button>
                          </div>
                          {(() => {
                            const origItem = sale.items.find(i => i.productId === item.productId && (i.unitType || 'piece') === item.unitType);
                            const origQty = origItem ? origItem.quantity : 0;
                            const diffQty = item.quantity - origQty;
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                                <span style={{ fontSize: '0.68rem', color: remainingPieces <= 2 ? '#DC2626' : '#64748B' }}>
                                  متبقي بالمخزن: {remainingPieces} قطعة
                                </span>
                                {origItem && diffQty < 0 && (
                                  <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800, background: '#DCFCE7', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
                                    ✓ سيُعاد ({Math.abs(diffQty)}) للمخزن
                                  </span>
                                )}
                                {origItem && diffQty > 0 && (
                                  <span style={{ fontSize: '0.68rem', color: '#2563EB', fontWeight: 800, background: '#DBEAFE', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
                                    ↑ سيُخصم ({diffQty}) إضافي من المخزن
                                  </span>
                                )}
                                {!origItem && (
                                  <span style={{ fontSize: '0.68rem', color: '#7C3AED', fontWeight: 800, background: '#EDE9FE', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
                                    ★ صنف جديد سيُخصم من المخزن
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Subtotal */}
                        <td style={{ padding: '0.7rem 0.8rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>
                          {lineSubtotal.toLocaleString()} {currency}
                        </td>

                        {/* Actions: Replace / Delete */}
                        <td style={{ padding: '0.7rem 0.8rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setReplacingIndex(isSelectedForReplace ? null : idx);
                                setSearchProductQuery('');
                              }}
                              style={{
                                background: isSelectedForReplace ? '#F59E0B' : '#EFF6FF',
                                color: isSelectedForReplace ? '#fff' : '#2563EB',
                                border: '1px solid',
                                borderColor: isSelectedForReplace ? '#D97706' : '#BFDBFE',
                                borderRadius: '6px', padding: '0.28rem 0.55rem',
                                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                fontFamily: 'inherit',
                              }}
                              title="استبدال هذا المنتج بمنتج آخر من المخزن"
                            >
                              <FiRefreshCw size={12} />
                              {isSelectedForReplace ? 'جاري الاستبدال' : 'استبدال'}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              style={{
                                background: '#FEF2F2', color: '#DC2626',
                                border: '1px solid #FECACA', borderRadius: '6px',
                                padding: '0.28rem 0.45rem', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center',
                              }}
                              title="حذف هذا المنتج من الفاتورة"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Financial Summary & Comparison Cards ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}>
            {/* New Total */}
            <div style={{
              background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
              border: '1.5px solid #BFDBFE', borderRadius: 'var(--radius-lg)',
              padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem',
            }}>
              <span style={{ fontSize: '0.78rem', color: '#1E40AF', fontWeight: 700 }}>
                إجمالي الفاتورة الجديد
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1E3A8A' }}>
                {newTotal.toLocaleString()} {currency}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#3B82F6' }}>
                {items.length} أصناف • {totalPieces} قطعة
              </span>
            </div>

            {/* Original Total */}
            <div style={{
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem',
              display: 'flex', flexDirection: 'column', gap: '0.2rem',
            }}>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>
                إجمالي الفاتورة السابقة
              </span>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#334155' }}>
                {sale.totalAmount.toLocaleString()} {currency}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                قبل التعديل
              </span>
            </div>

            {/* Difference */}
            <div style={{
              background: diffAmount > 0 ? '#F0FDF4' : (diffAmount < 0 ? '#FEF3C7' : '#F8FAFC'),
              border: '1px solid',
              borderColor: diffAmount > 0 ? '#BBF7D0' : (diffAmount < 0 ? '#FDE68A' : '#E2E8F0'),
              borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem',
              display: 'flex', flexDirection: 'column', gap: '0.2rem',
            }}>
              <span style={{
                fontSize: '0.78rem', fontWeight: 700,
                color: diffAmount > 0 ? '#15803D' : (diffAmount < 0 ? '#B45309' : '#64748B'),
              }}>
                فارق المبلغ
              </span>
              <span style={{
                fontSize: '1.15rem', fontWeight: 800,
                color: diffAmount > 0 ? '#166534' : (diffAmount < 0 ? '#92400E' : '#334155'),
              }}>
                {diffAmount > 0 ? `+ ${diffAmount.toLocaleString()} ${currency}` :
                 (diffAmount < 0 ? `- ${Math.abs(diffAmount).toLocaleString()} ${currency}` : `مطابق (0 ${currency})`)}
              </span>
              <span style={{ fontSize: '0.72rem', color: diffAmount > 0 ? '#16A34A' : (diffAmount < 0 ? '#D97706' : '#94A3B8') }}>
                {diffAmount > 0 ? 'مبلغ إضافي يُدفع أو يُقيد ديناً' : (diffAmount < 0 ? 'يُخصم من المبيعات ويُسترد للعميل' : 'لا يوجد فارق مالي')}
              </span>
            </div>
          </div>
        </div>

        {/* ── Fixed Footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.9rem 1.4rem', background: '#F8FAFC',
          borderTop: '1px solid #E2E8F0', flexShrink: 0,
          borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-outline-custom"
            style={{ fontWeight: 700 }}
          >
            <FiX size={15} /> إلغاء التعديل
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary-custom"
            style={{
              fontWeight: 800, padding: '0.65rem 1.5rem',
              fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.45rem',
              boxShadow: '0 6px 16px rgba(37,99,235,0.3)',
            }}
          >
            <FiCheck size={16} /> حفظ التعديلات وتحديث المخزون
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ─────────────────────────────────
interface DeleteModalProps {
  sale: SaleRecord;
  currency: string;
  onConfirm: (id: string, restoreStock: boolean) => void;
  onArchive: (id: string) => void;
  onClose: () => void;
}
function DeleteSaleModal({ sale, currency, onConfirm, onArchive, onClose }: DeleteModalProps) {
  const [restoreStock, setRestoreStock] = useState(true);

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3000, direction: 'rtl',
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 24px 54px rgba(71,85,105,0.28)',
          width: '100%', maxWidth: '440px', padding: '0',
          animation: 'modalScale 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Red Header */}
        <div style={{
          background: 'linear-gradient(135deg,#FEF2F2,#FFF5F5)',
          borderBottom: '1px solid #FECACA',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          padding: '1rem 1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#DC2626', fontSize: '1rem' }}>
            <FiAlertTriangle size={18} /> تأكيد حذف الفاتورة
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{
            background: '#FFF1F2', border: '1.5px solid #FECDD3',
            borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem',
            fontSize: '0.86rem', lineHeight: 1.7, color: '#9F1239',
          }}>
            <strong>هل أنت متأكد من حذف هذه الفاتورة؟</strong>
            <br />
            فاتورة رقم <strong style={{ color: '#DC2626' }}>{sale.invoiceNumber}</strong>
            {' '}للعميل <strong>{sale.customerName || 'عميل نقدي'}</strong>
            {' '}بمبلغ <strong>{sale.totalAmount.toLocaleString()} {currency}</strong>
          </div>

          {/* Warehouse Decision Card */}
          <div
            onClick={() => setRestoreStock(!restoreStock)}
            style={{
              background: restoreStock ? '#FFFBEB' : '#F8FAFC',
              border: `1.5px solid ${restoreStock ? '#FCD34D' : '#CBD5E1'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={restoreStock}
                onChange={e => setRestoreStock(e.target.checked)}
                style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#D97706', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: restoreStock ? '#B45309' : '#1E293B' }}>
                  {restoreStock ? 'إرجاع كميات المنتجات إلى المخزن' : 'حذف السجل فقط (دون المساس بالمخزن)'}
                </div>
                <div style={{ fontSize: '0.78rem', color: restoreStock ? '#92400E' : '#64748B', marginTop: '0.2rem', lineHeight: 1.5 }}>
                  {restoreStock
                    ? '⚠️ ستتم إضافة كميات أصناف الفاتورة إلى رصيد المخزن مجدداً (كما لو أن عملية البيع أُلغيت والبضاعة عادت للمخزن).'
                    : '🛡️ لن تتأثر كميات المخزن وستبقى كما هي دون زيادة (مناسب لتنظيف السجلات أو الفواتير المسلّمة فعلياً).'}
                </div>
              </div>
            </label>
          </div>

          {/* Sale items summary if restoring */}
          {restoreStock ? (
            <div style={{ background: '#F8FAFC', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.8rem', maxHeight: '120px', overflowY: 'auto' }}>
              <div style={{ fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>المنتجات التي ستُرجع للمخزون:</div>
              {sale.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', padding: '0.15rem 0' }}>
                  <span>• {item.productName}</span>
                  <span style={{ fontWeight: 700, color: '#16A34A' }}>+{item.unitType === 'package' ? item.quantity * (item.unitsPerPackage || 1) : item.quantity} قطعة</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#F1F5F9', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem', fontSize: '0.79rem', color: '#475569' }}>
              ℹ️ لن يتم إجراء أي تعديل على أرصدة المستودع. سيتم فقط مسح قيد الفاتورة من السجل.
            </div>
          )}

          {/* Optional Archive suggestion */}
          <div style={{
            background: '#FAF5FF',
            border: '1px dashed #DDD6FE',
            borderRadius: 'var(--radius-sm)',
            padding: '0.55rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: '#6D28D9',
          }}>
            <span>هل تفضل إخفاء الفاتورة دون حذفها؟</span>
            <button
              type="button"
              onClick={() => onArchive(sale.id)}
              style={{
                background: '#7C3AED',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.3rem 0.65rem',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontFamily: 'inherit',
              }}
            >
              <FiArchive size={12} /> أرشفة الفاتورة
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
            <button onClick={onClose} className="btn-outline-custom" style={{ fontWeight: 700 }}>
              <FiX size={14} /> إلغاء
            </button>
            <button
              onClick={() => onConfirm(sale.id, restoreStock)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                background: '#DC2626', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 1.2rem', fontWeight: 800, fontSize: '0.88rem',
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
              }}
            >
              <FiTrash2 size={14} /> تأكيد الحذف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Debt Payment Modal ──────────────────────────────────
interface DebtPayModalProps {
  sale: SaleRecord;
  currency: string;
  onPay: (saleId: string, amount: number, notes: string) => void;
  onClose: () => void;
}
function DebtPayModal({ sale, currency, onPay, onClose }: DebtPayModalProps) {
  const remaining = sale.remainingAmount ?? Math.max(0, sale.totalAmount - (sale.paidAmount ?? sale.totalAmount));
  const [amount, setAmount] = useState(remaining.toString());
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');

  const handlePay = () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setErr('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }
    if (parsed > remaining) {
      setErr(`المبلغ المدخل (${parsed.toLocaleString()}) أكبر من المتبقي (${remaining.toLocaleString()}) ${currency}`);
      return;
    }
    onPay(sale.id, parsed, notes);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3500, direction: 'rtl',
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 24px 54px rgba(71,85,105,0.3)',
          width: '100%', maxWidth: '460px',
          animation: 'modalScale 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#FFF7ED,#FFFBEB)',
          borderBottom: '1px solid #FDE68A',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          padding: '1rem 1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#92400E', fontSize: '1rem' }}>
            <FiCreditCard size={18} /> تسجيل دفعة / تسديد دين
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Invoice info */}
          <div style={{
            background: '#FFF7ED', border: '1.5px solid #FDE68A',
            borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.35rem',
          }}>
            <div style={{ fontWeight: 800, color: '#92400E', fontSize: '0.9rem' }}>
              {sale.invoiceNumber} — {sale.customerName || 'عميل'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.78rem', marginTop: '0.2rem' }}>
              <div style={{ textAlign: 'center', background: '#fff', borderRadius: '6px', padding: '0.3rem' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>الإجمالي</div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{sale.totalAmount.toLocaleString()} {currency}</div>
              </div>
              <div style={{ textAlign: 'center', background: '#F0FDF4', borderRadius: '6px', padding: '0.3rem' }}>
                <div style={{ color: '#15803D', fontSize: '0.7rem' }}>تم دفعه</div>
                <div style={{ fontWeight: 800, color: '#15803D' }}>{(sale.paidAmount ?? 0).toLocaleString()} {currency}</div>
              </div>
              <div style={{ textAlign: 'center', background: '#FEF2F2', borderRadius: '6px', padding: '0.3rem' }}>
                <div style={{ color: '#DC2626', fontSize: '0.7rem' }}>المتبقي</div>
                <div style={{ fontWeight: 800, color: '#DC2626' }}>{remaining.toLocaleString()} {currency}</div>
              </div>
            </div>
          </div>

          {/* Payment history */}
          {sale.paymentHistory && sale.paymentHistory.length > 0 && (
            <div style={{ background: '#F8FAFC', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
              <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.78rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FiClock size={13} /> سجل الدفعات السابقة
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '120px', overflowY: 'auto' }}>
                {sale.paymentHistory.map((pay, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#334155', padding: '0.2rem 0', borderBottom: '1px dashed #E2E8F0' }}>
                    <span style={{ color: 'var(--muted)' }}>{new Date(pay.date).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    <span>{pay.notes || 'دفعة'}</span>
                    <span style={{ fontWeight: 800, color: '#15803D' }}>+{pay.amount.toLocaleString()} {currency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Amount input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
              المبلغ المدفوع الآن <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                value={amount}
                onChange={e => { setAmount(e.target.value); setErr(''); }}
                min={0.01}
                max={remaining}
                step="any"
                placeholder="المبلغ..."
                className="form-control-custom"
                style={{ fontWeight: 800, fontSize: '1rem' }}
                autoFocus
              />
              <span style={{ fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{currency}</span>
              <button
                type="button"
                onClick={() => setAmount(remaining.toString())}
                style={{
                  background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB',
                  borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}
              >
                كامل المتبقي
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
              ملاحظة (اختياري)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="سبب التسديد أو أي ملاحظة..."
              className="form-control-custom"
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>
              ❌ {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-outline-custom" style={{ fontWeight: 700 }}>
              <FiX size={14} /> إلغاء
            </button>
            <button
              onClick={handlePay}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                background: '#16A34A', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 1.4rem', fontWeight: 800, fontSize: '0.9rem',
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
              }}
            >
              <FiCheckCircle size={15} /> تسجيل الدفعة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Expenses Modal Component ──────────────────────────────
interface ExpenseFormState {
  title: string;
  amount: string;
  category: string;
  date: string;
  notes: string;
}

const EMPTY_FORM: ExpenseFormState = {
  title: '',
  amount: '',
  category: EXPENSE_CATS[8],
  date: new Date().toISOString().slice(0, 10),
  notes: '',
};

interface ExpensesModalProps {
  currency: string;
  onClose: () => void;
  onExpensesChanged?: (expenses: Expense[]) => void;
}

function ExpensesModal({ currency, onClose, onExpensesChanged }: ExpensesModalProps) {
  const [expenses, setExpenses] = useState<Expense[]>(() => storeService.getExpenses());
  const [form, setForm] = useState<ExpenseFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showToast = (text: string, ok = true) => {
    setToastMsg({ text, ok });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);



  const openEditForm = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      title: exp.title,
      amount: String(exp.amount),
      category: exp.category,
      date: exp.date,
      notes: exp.notes || '',
    });
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('يرجى إدخال اسم المصروف'); return; }
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) { setFormError('يرجى إدخال مبلغ صحيح أكبر من صفر'); return; }
    if (!form.date) { setFormError('يرجى تحديد التاريخ'); return; }
    setFormError('');

    if (editingId) {
      storeService.updateExpense(editingId, {
        title: form.title.trim(),
        amount,
        category: form.category,
        date: form.date,
        notes: form.notes.trim(),
      });
      showToast('تم تحديث المصروف بنجاح ✓');
    } else {
      storeService.addExpense({
        title: form.title.trim(),
        amount,
        category: form.category,
        date: form.date,
        notes: form.notes.trim(),
        updatedAt: new Date().toISOString(),
      });
      showToast('تم إضافة المصروف بنجاح ✓');
    }
    const updated = storeService.getExpenses();
    setExpenses(updated);
    onExpensesChanged?.(updated);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = (id: string) => {
    storeService.deleteExpense(id);
    const updated = storeService.getExpenses();
    setExpenses(updated);
    onExpensesChanged?.(updated);
    setDeleteConfirm(null);
    showToast('تم حذف المصروف ✓', true);
  };

  const categoryColors: Record<string, string> = {
    '🚛 نقل وشحن': '#D97706',
    '🏢 إيجار': '#7C3AED',
    '⚡ كهرباء ومياه': '#0284C7',
    '📱 اتصالات وإنترنت': '#0891B2',
    '👷 رواتب وأجور': '#16A34A',
    '🛒 مستلزمات مكتبية': '#2563EB',
    '🔧 صيانة وإصلاح': '#B45309',
    '📦 تغليف': '#6366F1',
    '💰 أخرى': '#64748B',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3000, direction: 'rtl',
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={onClose}
    >
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          background: toastMsg.ok ? '#F0FDF4' : '#FEF2F2',
          border: `1.5px solid ${toastMsg.ok ? '#BBF7D0' : '#FECACA'}`,
          color: toastMsg.ok ? '#15803D' : '#B91C1C',
          borderRadius: '10px', padding: '0.65rem 1.4rem',
          fontWeight: 700, fontSize: '0.88rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {toastMsg.ok ? '✅' : '❌'} {toastMsg.text}
        </div>
      )}

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 24px 64px rgba(15,23,42,0.28)',
          width: '100%', maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          animation: 'modalScale 0.2s cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.5rem',
          background: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)',
          borderBottom: '1px solid #FDE68A',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '10px',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
            }}>
              <FiSliders size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#92400E' }}>
                إدارة المصاريف النثرية
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#B45309', fontWeight: 600 }}>
                إجمالي المصاريف: {totalExpenses.toLocaleString()} {currency}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#92400E', padding: '0.3rem', borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
            onMouseLeave={e => (e.currentTarget.style.color = '#92400E')}
          >
            <FiX size={22} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: Form */}
          <div style={{
            width: '320px', flexShrink: 0,
            borderLeft: '1px solid #E2E8F0',
            background: '#F8FAFC',
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
          }}>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
              {editingId ? '✏️ تعديل المصروف' : '➕ إضافة مصروف جديد'}
            </h4>

            {formError && (
              <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>اسم المصروف *</label>
                <input
                  type="text"
                  className="form-control-custom"
                  placeholder="مثال: إيجار المحل"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>التصنيف</label>
                <select
                  className="form-control-custom"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem' }}
                >
                  {EXPENSE_CATS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>المبلغ ({currency}) *</label>
                  <input
                    type="number"
                    className="form-control-custom"
                    placeholder="0"
                    min="0"
                    step="any"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>التاريخ *</label>
                  <input
                    type="date"
                    className="form-control-custom"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem' }}>ملاحظات</label>
                <input
                  type="text"
                  className="form-control-custom"
                  placeholder="ملاحظات اختيارية..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    background: editingId ? 'linear-gradient(135deg, #2563EB, #1D4ED8)' : 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    fontFamily: 'inherit',
                    boxShadow: editingId ? '0 4px 12px rgba(37,99,235,0.3)' : '0 4px 12px rgba(245,158,11,0.3)',
                  }}
                >
                  {editingId ? <><FiCheck size={15} /> حفظ التعديل</> : <><FiPlus size={15} /> إضافة</>}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setFormError(''); }}
                    style={{
                      padding: '0.55rem 0.75rem',
                      background: '#F1F5F9', color: '#64748B',
                      border: '1px solid #CBD5E1', borderRadius: '8px',
                      fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </form>

            {/* Summary by category */}
            {expenses.length > 0 && (
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.5rem' }}>ملخص حسب التصنيف:</div>
                {Object.entries(
                  expenses.reduce((acc, e) => {
                    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0', fontSize: '0.75rem' }}>
                    <span style={{ color: categoryColors[cat] || '#64748B', fontWeight: 600 }}>{cat}</span>
                    <span style={{ fontWeight: 800, color: '#0F172A' }}>{total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            {expenses.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '200px', color: '#94A3B8', gap: '0.75rem',
              }}>
                <FiSliders size={48} style={{ opacity: 0.3 }} />
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>لا توجد مصاريف مسجلة بعد</div>
                <div style={{ fontSize: '0.82rem' }}>استخدم النموذج على اليمين لإضافة مصروف</div>
              </div>
            ) : (
              <table className="table-custom" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>المصروف</th>
                    <th style={{ textAlign: 'center', width: '140px' }}>التصنيف</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>التاريخ</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>المبلغ</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} style={{ background: deleteConfirm === exp.id ? '#FEF2F2' : undefined }}>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{exp.title}</div>
                        {exp.notes && (
                          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.1rem' }}>{exp.notes}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          background: '#F1F5F9',
                          color: categoryColors[exp.category] || '#64748B',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                        }}>
                          {exp.category}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                          <FiCalendar size={11} />
                          {new Date(exp.date + 'T00:00:00').toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {deleteConfirm === exp.id ? (
                          <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              style={{ padding: '0.25rem 0.55rem', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              تأكيد
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              style={{ padding: '0.25rem 0.55rem', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 800, color: '#DC2626', fontSize: '0.92rem' }}>
                            -{Number(exp.amount).toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {deleteConfirm !== exp.id && (
                          <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => openEditForm(exp)}
                              className="btn-outline-custom"
                              style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', color: '#2563EB', borderColor: '#2563EB' }}
                              title="تعديل"
                            >
                              <FiEdit2 size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(exp.id)}
                              className="btn-outline-custom"
                              style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', color: '#DC2626', borderColor: '#DC2626' }}
                              title="حذف"
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', padding: '0.75rem' }}>
                      إجمالي المصاريف ({expenses.length} بند):
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 900, color: '#DC2626', fontSize: '1rem' }}>
                      -{totalExpenses.toLocaleString()} {currency}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main SalesHistory Page ───────────────────────────────
export default function SalesHistory() {

  const [sales, setSales] = useState<SaleRecord[]>(() => storeService.getSales());
  const [settings] = useState(() => storeService.getSettings());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [editSale, setEditSale] = useState<SaleRecord | null>(null);
  const [deleteSale, setDeleteSale] = useState<SaleRecord | null>(null);
  const [debtSale, setDebtSale] = useState<SaleRecord | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showExpenses, setShowExpenses] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>(() => storeService.getExpenses());


  // Auto-refresh sales & expenses on sync and on any local/cross-device change
  useEffect(() => {
    const unsubSync = storeService.subscribeSync(({ syncing: s }) => {
      if (!s) {
        setSales(storeService.getSales());
        setExpenses(storeService.getExpenses());
      }
    });
    const unsubSales = storeService.subscribeSales(() => {
      setSales(storeService.getSales());
    });
    const unsubExpenses = storeService.subscribeExpenses(() => {
      setExpenses(storeService.getExpenses());
    });
    return () => {
      unsubSync();
      unsubSales();
      unsubExpenses();
    };
  }, []);

  // Drag state
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const showToast = (text: string, ok = true) => {
    setToastMsg({ text, ok });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const activeCount = useMemo(() => sales.filter(s => !storeService.isSummaryRow(s) && !s.isArchived).length, [sales]);
  const archivedCount = useMemo(() => sales.filter(s => !storeService.isSummaryRow(s) && Boolean(s.isArchived)).length, [sales]);

  const filteredSales = useMemo(() => {
    let result = sales.filter(s => !storeService.isSummaryRow(s));

    if (archiveFilter === 'active') {
      result = result.filter(s => !s.isArchived);
    } else if (archiveFilter === 'archived') {
      result = result.filter(s => Boolean(s.isArchived));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        (s.invoiceNumber && s.invoiceNumber.toLowerCase().includes(q)) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        (s.items && s.items.some(i => i.productName && i.productName.toLowerCase().includes(q)))
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(s => (s.paymentStatus ?? 'paid') === filterStatus);
    }
    return result;
  }, [sales, search, filterStatus, archiveFilter]);

  const allSales = useMemo(() => sales.filter(s => !storeService.isSummaryRow(s)), [sales]);
  const totalRevenue = allSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  const totalProfit = allSales.reduce((sum, s) => sum + (Number(s.totalProfit) || 0), 0);
  const totalPaidAmount = allSales.reduce((sum, s) => sum + (Number(s.paidAmount) || Number(s.totalAmount) || 0), 0);
  const totalRemainingDebt = allSales.reduce((sum, s) => sum + (Number(s.remainingAmount) || 0), 0);
  const debtSalesCount = allSales.filter(s => (s.paymentStatus ?? 'paid') !== 'paid' || (Number(s.remainingAmount) || 0) > 0).length;
  const totalExpensesAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = totalProfit - totalExpensesAmount;


  const exportCSV = () => {
    const headers = ['رقم الفاتورة,التاريخ,العميل,المنتجات المباعة,الإجمالي,الربح,الملاحظات'];
    const rows = filteredSales.map(s => {
      const itemsStr = (s.items || []).map(i => `${i.productName} (${i.quantity}x${i.sellPrice})`).join(' + ') || s.notes || 'بضاعة عامة';
      return `"${s.invoiceNumber}","${s.createdAt}","${s.customerName || ''}","${itemsStr}",${s.totalAmount},${s.totalProfit},"${s.notes || ''}"`;
    });
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Handle edit save
  const handleEditSave = (
    id: string,
    data: {
      customerName: string;
      notes: string;
      items: {
        productId: string;
        quantity: number;
        sellPrice: number;
        unitType: 'piece' | 'package';
      }[];
    }
  ) => {
    const res = storeService.updateSale(id, data);
    if (res.success) {
      setSales(storeService.getSales());
      // Also update selected sale if open
      if (selectedSale?.id === id && res.sale) setSelectedSale(res.sale);
      showToast(res.message, true);
      setEditSale(null);
    } else {
      showToast(res.message, false);
    }
  };

  // Handle delete confirm
  const handleDeleteConfirm = (id: string, restoreStock: boolean = true) => {
    const res = storeService.deleteSale(id, restoreStock);
    if (res.success) {
      setSales(storeService.getSales());
      if (selectedSale?.id === id) setSelectedSale(null);
      showToast(res.message, true);
    } else {
      showToast(res.message, false);
    }
    setDeleteSale(null);
  };

  // Handle archive / unarchive sale
  const handleArchiveSale = (id: string, archive: boolean = true) => {
    const res = storeService.archiveSale(id, archive);
    if (res.success) {
      setSales(storeService.getSales());
      if (selectedSale?.id === id) {
        const found = storeService.getSales().find(s => s.id === id);
        if (found) setSelectedSale(found);
      }
      showToast(res.message, true);
    } else {
      showToast(res.message, false);
    }
    if (deleteSale?.id === id) {
      setDeleteSale(null);
    }
  };

  // Handle debt payment
  const handleDebtPayment = (saleId: string, amount: number, notes: string) => {
    const res = storeService.recordDebtPayment(saleId, amount, notes);
    if (res.success) {
      const updated = storeService.getSales();
      setSales(updated);
      // Update selectedSale if open
      if (selectedSale?.id === saleId) {
        const found = updated.find(s => s.id === saleId);
        if (found) setSelectedSale(found);
      }
      showToast(res.message, true);
      setDebtSale(null);
    } else {
      showToast(res.message, false);
    }
  };

  // ── Drag handlers ──────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!modalRef.current) return;
    isDragging.current = true;
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: modalPos.x, origY: modalPos.y,
    };
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !dragRef.current) return;
      setModalPos({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [modalPos]);

  const openInvoiceModal = (sale: SaleRecord) => {
    setModalPos({ x: 0, y: 0 });
    setSelectedSale(sale);
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Toast ── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, direction: 'rtl',
          background: toastMsg.ok ? '#F0FDF4' : '#FEF2F2',
          border: `1.5px solid ${toastMsg.ok ? '#BBF7D0' : '#FECACA'}`,
          color: toastMsg.ok ? '#15803D' : '#B91C1C',
          borderRadius: 'var(--radius-lg)', padding: '0.75rem 1.4rem',
          fontWeight: 700, fontSize: '0.88rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          animation: 'slideUp 0.2s ease',
        }}>
          {toastMsg.ok ? '✅' : '❌'} {toastMsg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>سجل المبيعات والفواتير</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            متابعة جميع عمليات البيع السابقة والأرباح وإعادة طباعة الفواتير
          </p>
        </div>
        <button onClick={exportCSV} className="btn-outline-custom">
          <FiDownload size={15} /> تصدير ملف CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
        <div className="stat-card" style={{ borderRight: '4px solid #3B82F6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label" style={{ fontWeight: 700 }}>
              {archiveFilter === 'active' ? 'الفواتير النشطة' : archiveFilter === 'archived' ? 'الفواتير المؤرشفة' : 'جميع الفواتير'}
            </span>
            <div className="stat-card-icon" style={{ background: '#EFF6FF', color: '#2563EB', width: 36, height: 36, marginBottom: 0 }}>
              <FiShoppingBag size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ marginTop: '0.4rem', color: 'var(--text-primary)' }}>{filteredSales.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
            {archiveFilter === 'active' ? `من أصل ${allSales.length} فاتورة مسجلة` : 'عملية بيع في هذا التبويب'}
          </div>
        </div>

        <div className="stat-card" style={{ borderRight: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label" style={{ fontWeight: 700 }}>إجمالي المبيعات</span>
            <div className="stat-card-icon" style={{ background: '#EFF6FF', color: '#2563EB', width: 36, height: 36, marginBottom: 0 }}>
              <FiDollarSign size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ marginTop: '0.4rem', color: 'var(--primary)' }}>
            {totalRevenue.toLocaleString()} <small style={{ fontSize: '0.75rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>إجمالي مبيعات المتجر (تشمل المؤرشفة)</div>
        </div>

        <div className="stat-card" style={{ borderRight: '4px solid #16A34A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label" style={{ fontWeight: 700 }}>المبالغ المحصلة (واصل)</span>
            <div className="stat-card-icon" style={{ background: '#F0FDF4', color: '#16A34A', width: 36, height: 36, marginBottom: 0 }}>
              <FiCheckCircle size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ marginTop: '0.4rem', color: '#16A34A' }}>
            {totalPaidAmount.toLocaleString()} <small style={{ fontSize: '0.75rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16A34A', marginTop: '0.2rem', fontWeight: 600 }}>المحصل الفعلي بالكامل</div>
        </div>

        <div className="stat-card" style={{ borderRight: totalRemainingDebt > 0 ? '4px solid #DC2626' : '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label" style={{ fontWeight: 700 }}>إجمالي الديون المتبقية</span>
            <div className="stat-card-icon" style={{ background: totalRemainingDebt > 0 ? '#FEF2F2' : '#F0FDF4', color: totalRemainingDebt > 0 ? '#DC2626' : '#16A34A', width: 36, height: 36, marginBottom: 0 }}>
              <FiCreditCard size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ marginTop: '0.4rem', color: totalRemainingDebt > 0 ? '#DC2626' : '#16A34A' }}>
            {totalRemainingDebt.toLocaleString()} <small style={{ fontSize: '0.75rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.75rem', color: totalRemainingDebt > 0 ? '#DC2626' : 'var(--muted)', marginTop: '0.2rem', fontWeight: 600 }}>
            {debtSalesCount > 0 ? `${debtSalesCount} فاتورة غير مسددة بالكامل` : 'جميع الفواتير مسددة ✅'}
          </div>
        </div>

        <div className="stat-card" style={{ borderRight: totalExpensesAmount > 0 ? '4px solid #F59E0B' : '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label" style={{ fontWeight: 700 }}>
              {totalExpensesAmount > 0 ? 'صافي الأرباح المحققة (بعد المصاريف)' : 'إجمالي الأرباح المحققة'}
            </span>
            <div className="stat-card-icon" style={{ background: netProfit >= 0 ? '#F0FDF4' : '#FEF2F2', color: netProfit >= 0 ? '#16A34A' : '#DC2626', width: 36, height: 36, marginBottom: 0 }}>
              <FiTrendingUp size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ marginTop: '0.4rem', color: netProfit >= 0 ? 'var(--success)' : '#DC2626' }}>
            {netProfit >= 0 ? `+${netProfit.toLocaleString()}` : netProfit.toLocaleString()} <small style={{ fontSize: '0.75rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
            {totalExpensesAmount > 0 ? (
              <>
                <span style={{ color: '#16A34A' }}>أرباح البيع: +{totalProfit.toLocaleString()}</span>
                <span style={{ color: '#DC2626' }}>المصاريف: -{totalExpensesAmount.toLocaleString()}</span>
              </>
            ) : (
              <span style={{ color: '#16A34A' }}>صافي الفائدة بعد حسم الكلفة</span>
            )}
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="table-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Scope Tabs: Active vs Archived vs All */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setArchiveFilter('active')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: archiveFilter === 'active' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: archiveFilter === 'active' ? 'var(--primary-100)' : 'var(--surface)',
                color: archiveFilter === 'active' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: archiveFilter === 'active' ? 800 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontFamily: 'inherit',
              }}
            >
              <FiShoppingBag size={14} /> الفواتير النشطة ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setArchiveFilter('archived')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: archiveFilter === 'archived' ? '2px solid #7C3AED' : '1px solid var(--border)',
                background: archiveFilter === 'archived' ? '#F5F3FF' : 'var(--surface)',
                color: archiveFilter === 'archived' ? '#7C3AED' : 'var(--text-secondary)',
                fontWeight: archiveFilter === 'archived' ? 800 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontFamily: 'inherit',
              }}
            >
              <FiArchive size={14} /> الأرشيف 📦 ({archivedCount})
            </button>
            <button
              type="button"
              onClick={() => setArchiveFilter('all')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: archiveFilter === 'all' ? '2px solid #475569' : '1px solid var(--border)',
                background: archiveFilter === 'all' ? '#F1F5F9' : 'var(--surface)',
                color: archiveFilter === 'all' ? '#334155' : 'var(--text-secondary)',
                fontWeight: archiveFilter === 'all' ? 800 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontFamily: 'inherit',
              }}
            >
              الكل ({activeCount + archivedCount})
            </button>

            {/* فاصل وزر المصاريف النثرية بجانب الأرشيف */}
            <div style={{ width: '1px', height: '22px', background: 'var(--border)', margin: '0 0.2rem' }} />
            <button
              type="button"
              id="btn-petty-expenses"
              onClick={() => setShowExpenses(true)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid #F59E0B',
                background: '#FFFBEB',
                color: '#B45309',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#FEF3C7';
                e.currentTarget.style.borderColor = '#D97706';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#FFFBEB';
                e.currentTarget.style.borderColor = '#F59E0B';
              }}
              title="إدارة وعرض المصاريف النثرية (نقل، إيجار، كهرباء...) وتخصم من إجمالي الأرباح"
            >
              <FiSliders size={14} color="#D97706" />
              <span>المصاريف النثرية 💸</span>
              {expenses.length > 0 && (
                <span style={{
                  background: '#F59E0B',
                  color: '#fff',
                  padding: '0.05rem 0.45rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 800
                }}>
                  {expenses.length}
                </span>
              )}
              {totalExpensesAmount > 0 && (
                <span style={{
                  background: '#DC2626',
                  color: '#fff',
                  padding: '0.05rem 0.45rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  direction: 'ltr',
                }}>
                  -{totalExpensesAmount.toLocaleString()} {settings.currency}
                </span>
              )}
            </button>
          </div>
          {archiveFilter === 'archived' && (
            <span style={{ fontSize: '0.78rem', color: '#7C3AED', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <FiArchive size={13} /> هذه الفواتير محفوظة في الأرشيف ولا تؤثر على حركة المخزن النشطة
            </span>
          )}
        </div>

        {/* Search input + Payment status filter */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <FiSearch size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              className="form-control-custom"
              placeholder="ابحث برقم الفاتورة، اسم العميل، أو اسم المنتج..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingRight: '2.8rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {([['all', 'حالة السداد: الكل'], ['paid', '✅ واصل'], ['partial', '⏳ جزئي'], ['unpaid', '🔴 دين']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFilterStatus(val)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: filterStatus === val ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: filterStatus === val ? 'var(--primary-100)' : 'var(--surface)',
                  color: filterStatus === val ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: filterStatus === val ? 800 : 600,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="table-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table-custom">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '120px' }}>رقم الفاتورة</th>
                <th style={{ textAlign: 'center', width: '130px' }}>التاريخ والوقت</th>
                <th style={{ textAlign: 'right', width: '120px' }}>العميل</th>
                <th style={{ textAlign: 'right' }}>المنتجات وتفاصيل البيع</th>
                <th style={{ textAlign: 'center', width: '120px' }}>إجمالي الفاتورة</th>
                <th style={{ textAlign: 'center', width: '130px' }}>المدفوع / المتبقي</th>
                <th style={{ textAlign: 'center', width: '100px' }}>حالة السداد</th>
                <th style={{ textAlign: 'center', width: '120px' }}>صافي الربح</th>
                <th style={{ textAlign: 'center', width: '180px' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--muted)' }}>
                    لا توجد أي فواتير مطابقة للبحث الحالي.
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => {
                  const status = s.paymentStatus ?? 'paid';
                  const sTotal = Number(s.totalAmount) || 0;
                  const sProfit = Number(s.totalProfit) || 0;
                  const paid = Number(s.paidAmount ?? sTotal) || 0;
                  const remaining = Number(s.remainingAmount) || Math.max(0, sTotal - paid);
                  const isDebt = status === 'unpaid' || status === 'partial' || remaining > 0;
                  return (
                    <tr key={s.id} style={{ background: isDebt ? 'rgba(254,242,242,0.4)' : undefined }}>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)' }}>
                        <div>{s.invoiceNumber}</div>
                        {s.isArchived && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                            background: '#EDE9FE', color: '#6D28D9',
                            padding: '0.1rem 0.35rem', borderRadius: '4px',
                            fontSize: '0.66rem', fontWeight: 700, marginTop: '2px'
                          }}>
                            <FiArchive size={10} /> مؤرشفة
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {new Date(s.createdAt).toLocaleString('ar-IQ', {
                          year: 'numeric', month: 'numeric', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {s.customerName || 'عميل نقدي'}
                        {s.customerPhone && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 400 }}>{s.customerPhone}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.8rem', maxWidth: '260px', lineHeight: 1.6 }}>
                          {(s.items && s.items.length > 0) ? (
                            s.items.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>• {item.productName}</span>
                                <span style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>
                                  ({item.quantity} × {(Number(item.sellPrice) || 0).toLocaleString()})
                                  {item.unitType === 'package' && (
                                    <span style={{ color: '#2563EB', marginRight: '4px' }}>
                                      [{item.unitName || 'طرد'} {item.unitsPerPackage ? `${item.unitsPerPackage}ق` : ''}]
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>{s.notes || 'بضاعة عامة'}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {sTotal.toLocaleString()} {settings.currency}
                      </td>
                      {/* Paid / Remaining columns */}
                      <td style={{ textAlign: 'center', fontSize: '0.78rem' }}>
                        <div style={{ color: '#15803D', fontWeight: 700 }}>✓ {paid.toLocaleString()}</div>
                        {remaining > 0 && (
                          <div style={{ color: '#DC2626', fontWeight: 700, marginTop: '0.1rem' }}>↩ {remaining.toLocaleString()}</div>
                        )}
                      </td>
                      {/* Payment Status Badge */}
                      <td style={{ textAlign: 'center' }}>
                        {status === 'paid'
                          ? <span className="badge-custom badge-success">واصل ✅</span>
                          : status === 'partial'
                            ? <span className="badge-custom badge-warning">جزئي ⏳</span>
                            : <span className="badge-custom badge-danger">دين 🔴</span>
                        }
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge-custom badge-success">
                          +{sProfit.toLocaleString()} {settings.currency}
                        </span>
                      </td>
                      {/* Action Buttons */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* Pay Debt */}
                          {isDebt && (
                            <button
                              onClick={() => setDebtSale(s)}
                              style={{
                                padding: '0.28rem 0.5rem', fontSize: '0.72rem', fontWeight: 800,
                                background: '#FFF7ED', color: '#D97706',
                                border: '1.5px solid #FDE68A', borderRadius: '6px',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                fontFamily: 'inherit',
                              }}
                              title="تسجيل دفعة / تسديد الدين"
                            >
                              <FiCreditCard size={12} /> دفع
                            </button>
                          )}
                          {/* Print */}
                          <button
                            onClick={() => openInvoiceModal(s)}
                            className="btn-outline-custom"
                            style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', fontWeight: 700 }}
                            title="معاينة وطباعة الفاتورة"
                          >
                            <FiPrinter size={12} />
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => setEditSale(s)}
                            className="btn-outline-custom"
                            style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', color: '#2563EB', borderColor: '#2563EB' }}
                            title="تعديل بيانات الفاتورة"
                          >
                            <FiEdit2 size={12} />
                          </button>
                          {/* Archive / Restore Button */}
                          {s.isArchived ? (
                            <button
                              onClick={() => handleArchiveSale(s.id, false)}
                              className="btn-outline-custom"
                              style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', color: '#16A34A', borderColor: '#16A34A', background: '#F0FDF4' }}
                              title="استعادة الفاتورة من الأرشيف إلى السجل النشط"
                            >
                              <FiRotateCcw size={12} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchiveSale(s.id, true)}
                              className="btn-outline-custom"
                              style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', color: '#7C3AED', borderColor: '#DDD6FE', background: '#FAF5FF' }}
                              title="أرشفة الفاتورة (إخفاء من السجل دون المساس بالمخزن)"
                            >
                              <FiArchive size={12} />
                            </button>
                          )}
                          {/* Delete */}
                          <button
                            onClick={() => setDeleteSale(s)}
                            className="btn-outline-custom"
                            style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', color: '#DC2626', borderColor: '#DC2626' }}
                            title="حذف الفاتورة"
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Draggable Invoice Preview Modal ── */}
      {selectedSale && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, direction: 'rtl',
            animation: 'fadeIn 0.18s ease',
          }}
          onClick={() => setSelectedSale(null)}
        >
          <div
            ref={modalRef}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              transform: `translate(${modalPos.x}px, ${modalPos.y}px)`,
              background: '#FFFFFF',
              border: '1.5px solid rgba(255,255,255,0.95)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 24px 54px rgba(71,85,105,0.28)',
              width: '100%', maxWidth: '700px', maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              animation: 'modalScale 0.2s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* Drag Handle */}
            <div
              onMouseDown={onMouseDown}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.65rem 1.1rem 0.55rem',
                background: 'linear-gradient(135deg,#EFF6FF,#F8FAFC)',
                borderBottom: '1px solid #E2E8F0',
                borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                cursor: 'grab', flexShrink: 0,
              }}
              title="اسحب لتحريك النافذة"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.82rem', fontWeight: 700 }}>
                <FiMove size={14} />
                <span>معاينة الفاتورة — {selectedSale.invoiceNumber}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => { setEditSale(selectedSale); }}
                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', borderRadius: '6px', padding: '0.2rem 0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', fontWeight: 700, fontFamily: 'inherit' }}
                  title="تعديل"
                >
                  <FiEdit2 size={12} /> تعديل
                </button>
                <button
                  onClick={() => setSelectedSale(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                  title="إغلاق"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ overflowY: 'auto', padding: '1.25rem', flex: 1 }}>
              <SaleInvoice
                sale={selectedSale}
                settings={settings}
                isNewSale={false}
                onClose={() => setSelectedSale(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editSale && (
        <EditSaleModal
          sale={editSale}
          currency={settings.currency}
          onSave={handleEditSave}
          onClose={() => setEditSale(null)}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteSale && (
        <DeleteSaleModal
          sale={deleteSale}
          currency={settings.currency}
          onConfirm={handleDeleteConfirm}
          onArchive={(id) => handleArchiveSale(id, true)}
          onClose={() => setDeleteSale(null)}
        />
      )}

      {/* ── Debt Payment Modal ── */}
      {debtSale && (
        <DebtPayModal
          sale={debtSale}
          currency={settings.currency}
          onPay={handleDebtPayment}
          onClose={() => setDebtSale(null)}
        />
      )}

      {/* ── Expenses Modal (المصاريف النثرية) ── */}
      {showExpenses && (
        <ExpensesModal
          currency={settings.currency}
          onExpensesChanged={(updated) => setExpenses(updated)}
          onClose={() => {
            setShowExpenses(false);
            setExpenses(storeService.getExpenses());
          }}
        />
      )}

    </div>
  );
}
