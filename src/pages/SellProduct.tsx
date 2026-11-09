import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiShoppingCart, FiPlus, FiMinus, FiTrash2,
  FiCheckCircle, FiSearch, FiAlertTriangle,
} from 'react-icons/fi';
import { storeService } from '../services/storeService';
import SaleInvoice from '../components/common/SaleInvoice';
import type { SimpleProduct, SaleRecord } from '../types';

interface CartItem {
  product: SimpleProduct;
  quantity: number;
  sellPrice: number;
  unitType?: 'piece' | 'package';
}

export default function SellProduct() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<SimpleProduct[]>(() => storeService.getProducts());
  const [settings] = useState(() => storeService.getSettings());

  // Search & Cart State
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('عميل نقدي');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'debt'>('full');
  const [paidInput, setPaidInput] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Completed Sale State
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null);

  // Auto-refresh products when store syncs with Google Sheets OR when products change directly
  useEffect(() => {
    const unsub = storeService.subscribeSync(({ syncing: s }) => {
      if (!s) {
        refreshProducts();
      }
    });
    const unsubProducts = storeService.subscribeProducts(() => {
      refreshProducts();
    });
    return () => {
      unsub();
      unsubProducts();
    };
  }, []);

  // If URL has ?productId=... auto-add that product
  useEffect(() => {
    const prodId = searchParams.get('productId');
    if (prodId) {
      const p = products.find(item => item.id === prodId);
      if (p && p.stock > 0) {
        addToCart(p);
      }
    }
  }, [searchParams]);

  const refreshProducts = () => {
    setProducts(storeService.getProducts());
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return products.filter(
      p => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const addToCart = (product: SimpleProduct, unitType: 'piece' | 'package' = 'piece') => {
    setErrorMsg('');
    if (product.stock <= 0) {
      setErrorMsg(`المنتج "${product.name}" نفد من المخزون ولا يمكن بيعه.`);
      return;
    }

    const isPkg = unitType === 'package' && (product.unitsPerPackage || 1) > 1;
    const unitsInPkg = product.unitsPerPackage || 1;
    const piecesPerUnit = isPkg ? unitsInPkg : 1;
    const defaultSellPrice = isPkg
      ? (product.packageSellPrice || (product.sellPrice * unitsInPkg))
      : product.sellPrice;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && (item.unitType || 'piece') === unitType);
      if (existing) {
        const totalPiecesNeeded = (existing.quantity + 1) * piecesPerUnit;
        if (totalPiecesNeeded > product.stock) {
          setErrorMsg(`لا يمكن بيع أكثر من ${product.stock} قطعة من "${product.name}".`);
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id && (item.unitType || 'piece') === unitType
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, sellPrice: defaultSellPrice, unitType }];
    });
  };

  const updateQuantity = (productId: string, delta: number, unitType: 'piece' | 'package' = 'piece') => {
    setErrorMsg('');
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId && (item.unitType || 'piece') === unitType) {
            const newQty = item.quantity + delta;
            const isPkg = (item.unitType || 'piece') === 'package' && (item.product.unitsPerPackage || 1) > 1;
            const pieces = isPkg ? newQty * (item.product.unitsPerPackage || 1) : newQty;
            if (pieces > item.product.stock) {
              setErrorMsg(`الكمية المتوفرة في المخزن هي (${item.product.stock}) قطعة فقط!`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const toggleUnitType = (productId: string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const currentUnit = item.unitType || 'piece';
      const newUnit: 'piece' | 'package' = currentUnit === 'piece' ? 'package' : 'piece';
      const unitsInPkg = item.product.unitsPerPackage || 1;
      const newSellPrice = newUnit === 'package'
        ? (item.product.packageSellPrice || (item.product.sellPrice * unitsInPkg))
        : item.product.sellPrice;
      return {
        ...item,
        unitType: newUnit,
        sellPrice: newSellPrice,
      };
    }));
  };

  const removeFromCart = (productId: string, unitType: 'piece' | 'package' = 'piece') => {
    setCart(prev => prev.filter(item => !(item.product.id === productId && (item.unitType || 'piece') === unitType)));
  };

  const clearCart = () => {
    setCart([]);
    setErrorMsg('');
    setCompletedSale(null);
  };

  // Totals
  const totalAmount = cart.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0);
  const totalCost = cart.reduce((sum, item) => {
    const isPkg = (item.unitType || 'piece') === 'package' && (item.product.unitsPerPackage || 1) > 1;
    const unitCost = isPkg ? (item.product.costPrice * (item.product.unitsPerPackage || 1)) : item.product.costPrice;
    return sum + unitCost * item.quantity;
  }, 0);
  const estimatedProfit = totalAmount - totalCost;

  // Calculate actual paid & remaining
  const effectivePaid = useMemo(() => {
    if (paymentType === 'full') return totalAmount;
    if (paymentType === 'debt') return 0;
    const parsed = parseFloat(paidInput);
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.min(parsed, totalAmount);
  }, [paymentType, paidInput, totalAmount]);

  const remainingDebt = Math.max(0, totalAmount - effectivePaid);

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      setErrorMsg('يرجى إضافة منتج واحد على الأقل لإتمام البيع');
      return;
    }

    // Require real customer name if there is a debt or partial payment
    if (remainingDebt > 0 && (!customerName.trim() || customerName.trim() === 'عميل نقدي')) {
      setErrorMsg('⚠️ يرجى كتابة اسم العميل الحقيقي لتسجيل الفاتورة الآجلة أو الدفع الجزئي ومتابعته لاحقاً');
      return;
    }

    const res = storeService.recordSale({
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        unitType: item.unitType || 'piece',
      })),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      notes: notes.trim(),
      paidAmount: effectivePaid,
      dueDate: dueDate || undefined,
    });

    if (res.success && res.sale) {
      setCompletedSale(res.sale);
      setCart([]);
      setPaidInput('');
      setCustomerPhone('');
      setDueDate('');
      setPaymentType('full');
      setErrorMsg('');
      refreshProducts();
    } else {
      setErrorMsg(res.error || 'فشلت عملية البيع، يرجى المحاولة مرة أخرى.');
    }
  };


  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>نقطة البيع وتسجيل فاتورة</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            اختر المنتج وحدد الكمية لإتمام البيع وخصم المخزون فورياً
          </p>
        </div>

        {completedSale && (
          <button
            onClick={() => { setCompletedSale(null); setCart([]); }}
            className="btn-primary-custom"
            style={{ fontWeight: 700 }}
          >
            <FiPlus size={16} /> عملية بيع جديدة
          </button>
        )}
      </div>

      {errorMsg && (
        <div style={{
          background: 'var(--danger-100)',
          color: '#B91C1C',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <FiAlertTriangle size={16} />
          {errorMsg}
        </div>
      )}

      {/* Invoice / Success Receipt View */}
      {completedSale ? (
        <SaleInvoice
          sale={completedSale}
          settings={settings}
          isNewSale={true}
          onNewSale={() => { setCompletedSale(null); setCart([]); }}
        />
      ) : (

        /* Active POS Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>

          {/* Left Column: Product Selector */}
          <div className="table-card" style={{ padding: '1.25rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>
                🔍 ابحث عن منتج بالاسم أو الباركود
              </label>
              <div style={{ position: 'relative' }}>
                <FiSearch size={16} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  type="text"
                  className="form-control-custom"
                  placeholder="ابحث أو امسح الباركود..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', maxHeight: '480px', overflowY: 'auto' }}>
              {filteredProducts.map(p => {
                const inCart = cart.find(item => item.product.id === p.id);
                const isOutOfStock = p.stock <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      background: inCart ? 'var(--primary-100)' : 'var(--surface)',
                      opacity: isOutOfStock ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        كود: {p.barcode} • الرصيد: <strong style={{ color: p.stock <= p.minStock ? 'var(--danger)' : 'inherit' }}>{p.stock}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                        {p.sellPrice.toLocaleString()} {settings.currency}
                      </div>
                      {isOutOfStock ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700 }}>نفد!</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary-custom"
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', background: inCart ? 'var(--primary)' : '#22C55E', borderColor: 'transparent' }}
                        >
                          {inCart ? `في السلة (${inCart.quantity})` : 'إضافة +'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Cart & Checkout */}
          <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiShoppingCart size={18} /> سلة البيع ({cart.reduce((s, i) => s + i.quantity, 0)} قطعة)
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="btn-outline-custom"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: 'var(--danger)' }}
                >
                  تفريغ السلة
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div style={{ flex: '1 1 auto', minHeight: '180px', maxHeight: '300px', overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
                  <FiShoppingCart size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>السلة فارغة حالياً</p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.75rem' }}>اختر منتجات من القائمة لإضافتها إلى الفاتورة</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {cart.map(item => {
                    const hasPackage = !!(item.product.unitsPerPackage && item.product.unitsPerPackage > 1);
                    const isPkg = item.unitType === 'package';
                    return (
                      <div
                        key={`${item.product.id}-${item.unitType || 'piece'}`}
                        style={{
                          padding: '0.6rem 0.8rem',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ flex: '1 1 auto' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.product.name}</span>
                            {hasPackage && (
                              <button
                                type="button"
                                onClick={() => toggleUnitType(item.product.id)}
                                style={{
                                  border: '1px solid #CBD5E1',
                                  background: isPkg ? '#EFF6FF' : '#F8FAFC',
                                  color: isPkg ? '#1D4ED8' : '#475569',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="اضغط للتحويل بين البيع بالقطعة أو بالشليف"
                              >
                                {isPkg ? `📦 ${item.product.packageUnitName || 'شليف'} (${item.product.unitsPerPackage}ق)` : '🔹 بالقطعة'}
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            المتوفر: {item.product.stock} ق | سعر {isPkg ? (item.product.packageUnitName || 'الشليف') : 'القطعة'}: {item.sellPrice.toLocaleString()} {settings.currency}
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1, item.unitType || 'piece')}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FiMinus size={12} />
                          </button>
                          <span style={{ fontWeight: 800, width: '22px', textAlign: 'center', fontSize: '0.9rem' }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1, item.unitType || 'piece')}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FiPlus size={12} />
                          </button>
                        </div>

                        <div style={{ textAlign: 'left', minWidth: '70px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                            {(item.sellPrice * item.quantity).toLocaleString()}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id, item.unitType || 'piece')}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.2rem' }}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Mode Selector & Customer Info */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                  طريقة وسداد الفاتورة
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentType('full')}
                    style={{
                      padding: '0.55rem 0.3rem',
                      borderRadius: 'var(--radius-md)',
                      border: paymentType === 'full' ? '2px solid #16A34A' : '1px solid var(--border)',
                      background: paymentType === 'full' ? '#DCFCE7' : 'var(--surface)',
                      color: paymentType === 'full' ? '#15803D' : 'inherit',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🟢 واصل بالكامل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('partial');
                      if (!paidInput) setPaidInput(Math.floor(totalAmount / 2).toString());
                    }}
                    style={{
                      padding: '0.55rem 0.3rem',
                      borderRadius: 'var(--radius-md)',
                      border: paymentType === 'partial' ? '2px solid #D97706' : '1px solid var(--border)',
                      background: paymentType === 'partial' ? '#FEF3C7' : 'var(--surface)',
                      color: paymentType === 'partial' ? '#B45309' : 'inherit',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🟡 دفع جزئي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('debt');
                      setPaidInput('0');
                    }}
                    style={{
                      padding: '0.55rem 0.3rem',
                      borderRadius: 'var(--radius-md)',
                      border: paymentType === 'debt' ? '2px solid #DC2626' : '1px solid var(--border)',
                      background: paymentType === 'debt' ? '#FEE2E2' : 'var(--surface)',
                      color: paymentType === 'debt' ? '#B91C1C' : 'inherit',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🔴 آجل (دين)
                  </button>
                </div>
              </div>

              {/* Partial Payment Amount Input */}
              {paymentType === 'partial' && (
                <div style={{ background: '#FFFBEB', border: '1px dashed #F59E0B', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.75rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 700 }}>
                    المبلغ الواصل (المدفوع نقداً الآن):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      className="form-control-custom"
                      value={paidInput}
                      onChange={e => setPaidInput(e.target.value)}
                      placeholder="أدخل المبلغ الواصل..."
                      style={{ fontSize: '0.9rem', fontWeight: 800, padding: '0.4rem 0.6rem' }}
                      min={0}
                      max={totalAmount}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)' }}>{settings.currency}</span>
                  </div>
                </div>
              )}

              {/* Customer & Phone info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: paymentType !== 'full' ? 800 : 500, color: paymentType !== 'full' ? '#DC2626' : 'inherit' }}>
                    اسم العميل {paymentType !== 'full' ? '★ (مطلوب)' : '(اختياري)'}
                  </label>
                  <input
                    type="text"
                    className="form-control-custom"
                    placeholder={paymentType !== 'full' ? 'اكتب اسم العميل المدين...' : 'عميل نقدي'}
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', borderColor: (paymentType !== 'full' && (!customerName || customerName === 'عميل نقدي')) ? '#EF4444' : undefined }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>
                    {paymentType !== 'full' ? 'رقم هاتف العميل' : 'ملاحظة الفاتورة'}
                  </label>
                  {paymentType !== 'full' ? (
                    <input
                      type="tel"
                      className="form-control-custom"
                      placeholder="0770xxxxxxx"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                      dir="ltr"
                    />
                  ) : (
                    <input
                      type="text"
                      className="form-control-custom"
                      placeholder="نقدي، تحويل..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                    />
                  )}
                </div>
              </div>

              {/* Extra note and due date row if debt/partial */}
              {paymentType !== 'full' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>تاريخ الاستحقاق (اختياري)</label>
                    <input
                      type="date"
                      className="form-control-custom"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>ملاحظات الفاتورة</label>
                    <input
                      type="text"
                      className="form-control-custom"
                      placeholder="ملاحظات..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                    />
                  </div>
                </div>
              )}

              {/* Summary Calculation */}
              <div style={{
                background: remainingDebt > 0 ? '#FEF2F2' : 'var(--surface-muted)',
                border: remainingDebt > 0 ? '1px solid #FECACA' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>إجمالي المبلغ المستحق:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>
                    {totalAmount.toLocaleString()} <small style={{ fontSize: '0.75rem' }}>{settings.currency}</small>
                  </span>
                </div>

                {remainingDebt > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#15803D' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>المبلغ الواصل (المدفوع):</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                        {effectivePaid.toLocaleString()} {settings.currency}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#DC2626', borderTop: '1px dashed #FECACA', paddingTop: '0.35rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>المتبقي بذمة العميل (دين):</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900 }}>
                        {remainingDebt.toLocaleString()} {settings.currency}
                      </span>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>الربح التقديري:</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>
                    +{estimatedProfit.toLocaleString()} {settings.currency}
                  </span>
                </div>
              </div>

              {/* Complete Sale Button */}
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={cart.length === 0}
                className="btn-primary-custom"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  background: cart.length === 0 ? 'var(--muted)' : (remainingDebt > 0 ? '#D97706' : '#22C55E'),
                  borderColor: 'transparent',
                }}
              >
                <FiCheckCircle size={18} />
                {remainingDebt > 0
                  ? (paymentType === 'debt' ? 'تسجيل كفاتورة دين بالكامل' : 'تسجيل البيع بدفع جزئي ومتبقي دين')
                  : 'إتمام البيع نقداً وخصم المخزون'}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
