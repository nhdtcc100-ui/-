import { useState, useMemo, useEffect } from 'react';

import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiShoppingCart,
  FiX, FiCheck, FiDownload, FiTag,
  FiDollarSign, FiPackage, FiTrendingUp, FiAlertTriangle,
  FiLayers, FiBarChart2, FiMinus
} from 'react-icons/fi';
import { storeService } from '../services/storeService';
import SaleInvoice from '../components/common/SaleInvoice';
import type { SimpleProduct, SaleRecord } from '../types';

export default function Products() {

  const [products, setProducts] = useState<SimpleProduct[]>(() => storeService.getProducts());
  const [sales, setSales] = useState<SaleRecord[]>(() => storeService.getSales());
  const [settings, setSettings] = useState(() => storeService.getSettings());

  // Search & Filter
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: 'عام',
    costPrice: '',
    sellPrice: '',
    stock: '',
    minStock: '5',
    notes: '',
  });
  const [formError, setFormError] = useState('');

  // ── Quick Sell Modal State (البيع المباشر من قسم المنتجات) ──
  const [quickSellProduct, setQuickSellProduct] = useState<SimpleProduct | null>(null);
  const [sellQty, setSellQty] = useState<number>(1);
  const [sellPriceInput, setSellPriceInput] = useState<string>('');
  const [sellUnitType, setSellUnitType] = useState<'piece' | 'package'>('piece');
  const [sellCustomerName, setSellCustomerName] = useState<string>('عميل نقدي');
  const [sellCustomerPhone, setSellCustomerPhone] = useState<string>('');
  const [sellPaymentType, setSellPaymentType] = useState<'full' | 'partial' | 'debt'>('full');
  const [sellPaidInput, setSellPaidInput] = useState<string>('');
  const [sellNotes, setSellNotes] = useState<string>('');
  const [sellError, setSellError] = useState<string>('');
  const [completedQuickSale, setCompletedQuickSale] = useState<SaleRecord | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const refreshList = () => {
    setProducts(storeService.getProducts());
    setSales(storeService.getSales());
    setSettings(storeService.getSettings());
  };

  useEffect(() => {
    // 1. Listen for sync status changes (syncing indicator + refresh on completion)
    const unsub = storeService.subscribeSync(({ syncing: _s }) => {
      if (!_s) {
        refreshList();
      }
    });

    // 2. Listen for direct product changes (from any pull or local edit)
    const unsubProducts = storeService.subscribeProducts(() => {
      refreshList();
    });

    // 3. Listen for sales changes so sales count & profit cards update live
    const unsubSales = storeService.subscribeSales(() => {
      refreshList();
    });

    return () => {
      unsub();
      unsubProducts();
      unsubSales();
    };
  }, []);


  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [products]);

  // Overall Warehouse Stats
  const cleanSales = useMemo(() => sales.filter(s => !storeService.isSummaryRow(s)), [sales]);
  const totalSalesAmount = useMemo(() => cleanSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0), [cleanSales]);
  const totalRealizedProfit = useMemo(() => cleanSales.reduce((sum, s) => sum + (Number(s.totalProfit) || 0), 0), [cleanSales]);
  const totalStockUnits = useMemo(() => products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0), [products]);
  const totalInitialCostAll = useMemo(() => products.reduce((acc, p) => acc + ((Number(p.costPrice) || 0) * (Number(p.stock) || 0)), 0), [products]);
  const totalExpectedSellAll = useMemo(() => products.reduce((acc, p) => acc + ((Number(p.sellPrice) || 0) * (Number(p.stock) || 0)), 0), [products]);
  const totalExpectedProfitAll = totalExpectedSellAll - totalInitialCostAll;
  const lowStockCount = useMemo(() => products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5)).length, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  // Filtered totals for table footer
  const filteredStockUnits = useMemo(() => filteredProducts.reduce((acc, p) => acc + (p.stock || 0), 0), [filteredProducts]);
  const filteredInitialCost = useMemo(() => filteredProducts.reduce((acc, p) => acc + ((p.costPrice || 0) * (p.stock || 0)), 0), [filteredProducts]);
  const filteredExpectedSell = useMemo(() => filteredProducts.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.stock || 0)), 0), [filteredProducts]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      barcode: 'PRD-' + Math.floor(100000 + Math.random() * 900000),
      category: 'عام',
      costPrice: '',
      sellPrice: '',
      stock: '10',
      minStock: '5',
      notes: '',
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (p: SimpleProduct) => {
    setEditingId(p.id);
    setFormData({
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      costPrice: String(p.costPrice),
      sellPrice: String(p.sellPrice),
      stock: String(p.stock),
      minStock: String(p.minStock),
      notes: p.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف المنتج: "${name}"؟`)) {
      storeService.deleteProduct(id);
      refreshList();
    }
  };

  // ── Quick Sell Handlers ──
  const openQuickSellModal = (p: SimpleProduct) => {
    setQuickSellProduct(p);
    setSellQty(1);
    setSellUnitType('piece');
    setSellPriceInput(String(p.sellPrice || 0));
    setSellCustomerName('عميل نقدي');
    setSellCustomerPhone('');
    setSellPaymentType('full');
    setSellPaidInput('');
    setSellNotes('');
    setSellError('');
  };

  const handleUnitChange = (newUnit: 'piece' | 'package') => {
    if (!quickSellProduct) return;
    setSellUnitType(newUnit);
    const unitsInPkg = quickSellProduct.unitsPerPackage || 1;
    if (newUnit === 'package') {
      const pkgPrice = quickSellProduct.packageSellPrice || (quickSellProduct.sellPrice * unitsInPkg);
      setSellPriceInput(String(pkgPrice));
    } else {
      setSellPriceInput(String(quickSellProduct.sellPrice));
    }
  };

  // Quick sell live calculations
  const quickEffectiveSellPrice = parseFloat(sellPriceInput) || 0;
  const quickIsPkg = sellUnitType === 'package' && (quickSellProduct?.unitsPerPackage || 1) > 1;
  const quickUnitsInPkg = quickSellProduct?.unitsPerPackage || 1;
  const quickPiecesNeeded = quickIsPkg ? sellQty * quickUnitsInPkg : sellQty;
  const quickUnitCost = quickIsPkg ? ((quickSellProduct?.costPrice || 0) * quickUnitsInPkg) : (quickSellProduct?.costPrice || 0);
  const quickTotalAmount = quickEffectiveSellPrice * sellQty;
  const quickProfit = (quickEffectiveSellPrice - quickUnitCost) * sellQty;

  const handleConfirmQuickSell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSellProduct) return;
    setSellError('');

    if (sellQty <= 0) {
      setSellError('كمية البيع يجب أن تكون 1 على الأقل');
      return;
    }

    if (quickPiecesNeeded > quickSellProduct.stock) {
      setSellError(`الكمية المتوفرة بالمخزن هي (${quickSellProduct.stock}) قطعة فقط، ولا تكفي لبيع (${sellQty} ${quickIsPkg ? (quickSellProduct.packageUnitName || 'شليف') : 'قطعة'} = ${quickPiecesNeeded} قطعة)!`);
      return;
    }

    const total = quickTotalAmount;
    let paid = total;
    if (sellPaymentType === 'debt') {
      paid = 0;
    } else if (sellPaymentType === 'partial') {
      paid = parseFloat(sellPaidInput) || 0;
      if (paid < 0) paid = 0;
      if (paid > total) paid = total;
    }
    const debtRemaining = Math.max(0, total - paid);

    if (debtRemaining > 0 && (!sellCustomerName.trim() || sellCustomerName.trim() === 'عميل نقدي')) {
      setSellError('⚠️ يرجى كتابة اسم العميل الحقيقي لتسجيل الفاتورة الآجلة ومتابعة الدين لاحقاً');
      return;
    }

    const res = storeService.recordSale({
      items: [{
        productId: quickSellProduct.id,
        quantity: sellQty,
        sellPrice: quickEffectiveSellPrice,
        unitType: sellUnitType,
      }],
      customerName: sellCustomerName.trim() || 'عميل نقدي',
      customerPhone: sellCustomerPhone.trim(),
      paidAmount: paid,
      notes: sellNotes.trim(),
    });

    if (res.success && res.sale) {
      const sale = res.sale;
      setQuickSellProduct(null);
      refreshList();
      setToastMsg({
        text: `تم تسجيل البيع بنجاح! فاتورة #${sale.invoiceNumber} بقيمة (${sale.totalAmount.toLocaleString()} ${settings.currency}) وأرباح (+${sale.totalProfit.toLocaleString()} ${settings.currency})`,
        ok: true
      });
      setTimeout(() => setToastMsg(null), 5000);
      setCompletedQuickSale(sale);
    } else {
      setSellError(res.error || 'فشلت عملية البيع، يرجى التحقق من المدخلات.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('يرجى إدخال اسم المنتج');
      return;
    }

    const cost = parseFloat(formData.costPrice) || 0;
    const sell = parseFloat(formData.sellPrice) || 0;
    const stock = parseInt(formData.stock, 10) || 0;
    const minStock = parseInt(formData.minStock, 10) || 0;

    if (sell < 0 || cost < 0 || stock < 0) {
      setFormError('الأسعار والكميات لا يمكن أن تكون سالبة');
      return;
    }

    if (editingId) {
      storeService.updateProduct(editingId, {
        name: formData.name.trim(),
        barcode: formData.barcode.trim(),
        category: formData.category.trim() || 'عام',
        costPrice: cost,
        sellPrice: sell,
        stock,
        minStock,
        notes: formData.notes.trim(),
      });
    } else {
      storeService.addProduct({
        name: formData.name.trim(),
        barcode: formData.barcode.trim() || 'BAR-' + Date.now(),
        category: formData.category.trim() || 'عام',
        costPrice: cost,
        sellPrice: sell,
        stock,
        minStock,
        notes: formData.notes.trim(),
      });
    }

    setShowModal(false);
    refreshList();
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ['المعرف,اسم المنتج,الباركود,التصنيف,سعر الشراء,سعر البيع,الكمية المتوفرة,الحد الأدنى,ملاحظات'];
    const rows = products.map(p =>
      `"${p.id}","${p.name}","${p.barcode}","${p.category}",${p.costPrice},${p.sellPrice},${p.stock},${p.minStock},"${p.notes || ''}"`
    );
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Action Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>إدارة المنتجات والمخزون</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            إضافة منتجات جديدة، تعديل الأسعار، ومراقبة الكميات المتوفرة للبيع
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={exportCSV} className="btn-outline-custom" title="تصدير كملف CSV">
            <FiDownload size={14} />
            CSV
          </button>

          <button onClick={openAddModal} className="btn-primary-custom" style={{ fontWeight: 700 }}>
            <FiPlus size={16} />
            إضافة منتج جديد
          </button>
        </div>
      </div>



      {/* ── Key Analytics Cards Grid (Balanced Side-by-Side كما في الصفحة الرئيسية) ── */}
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
            +{totalRealizedProfit.toLocaleString()} <small style={{ fontSize: '0.7rem' }}>{settings.currency}</small>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#16A34A', marginTop: '0.25rem', fontWeight: 600 }}>
            من إجمالي الفواتير المنجزة
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
            أرباح متوقعة: +{totalExpectedProfitAll.toLocaleString()}
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
        <div className="stat-card" style={{ borderRight: lowStockCount > 0 ? '4px solid #DC2626' : '4px solid #16A34A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-card-label" style={{ fontWeight: 700, margin: 0 }}>نواقص المخزون</div>
            <div className="stat-card-icon" style={{
              background: lowStockCount > 0 ? '#FEF2F2' : '#F0FDF4',
              color: lowStockCount > 0 ? '#DC2626' : '#16A34A',
              width: 36, height: 36, marginBottom: 0
            }}>
              <FiAlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: lowStockCount > 0 ? '#DC2626' : '#16A34A', marginTop: '0.4rem', fontSize: '1.45rem' }}>
            {lowStockCount} <small style={{ fontSize: '0.7rem' }}>أصناف</small>
          </div>
          <div style={{ fontSize: '0.74rem', color: lowStockCount > 0 ? '#DC2626' : 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {lowStockCount > 0 ? 'بحاجة إلى إعادة شراء' : 'المخزون متوفر بالكامل'}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="table-card" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <FiSearch size={16} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="text"
            className="form-control-custom"
            placeholder="ابحث بالاسم، الباركود، أو التصنيف..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: '2.5rem' }}
          />
        </div>

        <select
          className="form-control-custom"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '150px' }}
        >
          <option value="ALL">جميع التصنيفات ({products.length})</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Products Table (Desktop & Tablet View) */}
      <div className="table-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table-custom">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>المنتج</th>
                <th>التصنيف</th>
                <th>سعر الشراء (للقطعة)</th>
                <th>سعر البيع (للقطعة)</th>
                <th>المخزون المتوفر</th>
                <th style={{ background: '#EEF2FF', color: '#3730A3' }}>مجموع كلفة الشراء الأولية</th>
                <th>إجمالي قيمة البيع</th>
                <th>الحالة</th>
                <th style={{ textAlign: 'center' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                    لا توجد منتجات مطابقة لعملية البحث.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const productCostTotal = p.costPrice * p.stock;
                  const productSellTotal = p.sellPrice * p.stock;
                  const isLow = p.stock <= p.minStock;

                  return (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--muted)', fontWeight: 600 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                          <FiTag size={11} /> {p.barcode}
                        </div>
                      </td>
                      <td>
                        <span className="badge-custom badge-muted">{p.category}</span>
                      </td>
                      <td>{p.costPrice.toLocaleString()} {settings.currency}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {p.sellPrice.toLocaleString()} {settings.currency}
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: isLow ? 'var(--danger)' : 'var(--text-primary)',
                        }}>
                          {p.stock}
                        </span>
                      </td>
                      {/* مجموع كلفة الشراء الأولية للمنتج */}
                      <td style={{ background: '#F5F3FF' }}>
                        <span style={{
                          fontWeight: 800,
                          color: '#5B21B6',
                          background: '#EDE9FE',
                          padding: '0.25rem 0.55rem',
                          borderRadius: '6px',
                          display: 'inline-block',
                        }}>
                          {productCostTotal.toLocaleString()} {settings.currency}
                        </span>
                      </td>
                      {/* إجمالي قيمة البيع */}
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {productSellTotal.toLocaleString()} {settings.currency}
                      </td>
                      <td>
                        {p.stock <= 0 ? (
                          <span className="badge-custom badge-danger">نفد المخزون ❌</span>
                        ) : isLow ? (
                          <span className="badge-custom badge-warning">منخفض ({p.stock}) ⚠️</span>
                        ) : (
                          <span className="badge-custom badge-success">متوفر ({p.stock}) ✅</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => openQuickSellModal(p)}
                            className="btn-primary-custom"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', background: '#22C55E', borderColor: '#22C55E' }}
                            title="بيع هذا المنتج مباشرة"
                          >
                            <FiShoppingCart size={13} /> بيع
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="btn-outline-custom"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}
                            title="تعديل المنتج"
                          >
                            <FiEdit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="btn-outline-custom"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            title="حذف المنتج"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Summary Totals */}
            {filteredProducts.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', fontWeight: 800 }}>
                    الإجمالي العام للمنتجات المعروضة ({filteredProducts.length} صنف):
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                    {filteredStockUnits.toLocaleString()} قطعة
                  </td>
                  <td style={{ background: '#EDE9FE', color: '#5B21B6', fontWeight: 800 }}>
                    {filteredInitialCost.toLocaleString()} {settings.currency}
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                    {filteredExpectedSell.toLocaleString()} {settings.currency}
                  </td>
                  <td colSpan={2}>-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>



      {/* Add / Edit Modal — No outer scrollbar, inner scroll hidden */}
      {showModal && (
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
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              border: '1.5px solid rgba(255,255,255,0.95)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 24px 54px rgba(71,85,105,0.28), inset 2px 2px 4px rgba(255,255,255,0.95)',
              width: '100%', maxWidth: '540px',
              maxHeight: '92vh',
              overflow: 'hidden',           /* No outer scrollbar */
              display: 'flex', flexDirection: 'column',
              animation: 'modalScale 0.2s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* ── Fixed Header ── */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.85rem 1.25rem',
              background: 'linear-gradient(135deg,#EFF6FF,#F8FAFC)',
              borderBottom: '1px solid #E2E8F0',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              flexShrink: 0,
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                {editingId ? '✏️ تعديل بيانات المنتج' : '➕ إضافة منتج جديد إلى المخزن'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '0.2rem', borderRadius: '6px' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >
                <FiX size={20} />
              </button>
            </div>

            {/* ── Scrollable Form Area (scrollbar hidden) ── */}
            <div
              className="no-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <form
                onSubmit={handleSubmit}
                style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                {formError && (
                  <div style={{ background: 'var(--danger-100)', color: '#B91C1C', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600 }}>
                    ⚠️ {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">اسم المنتج *</label>
                  <input
                    type="text" required
                    className="form-control-custom"
                    placeholder="مثال: شاحن أنكر 20 واط"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">الباركود / الكود</label>
                    <input type="text" className="form-control-custom" placeholder="692123..."
                      value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">التصنيف</label>
                    <input type="text" className="form-control-custom" placeholder="مثال: إلكترونيات"
                      value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">سعر التكلفة ({settings.currency})</label>
                    <input type="number" min="0" step="any" className="form-control-custom" placeholder="15000"
                      value={formData.costPrice} onChange={e => setFormData({ ...formData, costPrice: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">سعر البيع ({settings.currency}) *</label>
                    <input type="number" required min="0" step="any" className="form-control-custom" placeholder="22000"
                      value={formData.sellPrice} onChange={e => setFormData({ ...formData, sellPrice: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">الكمية المتوفرة حالياً *</label>
                    <input type="number" required min="0" className="form-control-custom" placeholder="50"
                      value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">تنبيه عند وصول الرصيد إلى</label>
                    <input type="number" min="0" className="form-control-custom" placeholder="5"
                      value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات إضافية (اختياري)</label>
                  <textarea className="form-control-custom" rows={2}
                    placeholder="ملاحظات أو مواصفات المنتج..."
                    value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>

                {/* ── Fixed Footer Buttons ── */}
                <div style={{
                  display: 'flex', gap: '0.75rem', justifyContent: 'flex-end',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #F1F5F9', marginTop: '0.25rem',
                }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-outline-custom">إلغاء</button>
                  <button type="submit" className="btn-primary-custom" style={{ fontWeight: 700 }}>
                    <FiCheck size={16} />
                    {editingId ? 'حفظ التعديلات' : 'إضافة المنتج'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
           Quick Sell Modal
          ════════════════════════════════════════════ */}
      {quickSellProduct && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2100, direction: 'rtl',
            animation: 'fadeIn 0.18s ease',
          }}
          onClick={() => setQuickSellProduct(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 28px 60px rgba(15,23,42,0.35)',
              width: '100%', maxWidth: '520px',
              maxHeight: '92vh',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              animation: 'modalScale 0.2s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg,#166534,#15803d)',
              padding: '0.9rem 1.25rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>🛒 بيع سريع</div>
                <div style={{ color: '#bbf7d0', fontSize: '0.78rem', marginTop: '2px' }}>{quickSellProduct.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setQuickSellProduct(null)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', display: 'flex', padding: '0.35rem', lineHeight: 1 }}
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <form id="quick-sell-form" onSubmit={handleConfirmQuickSell} style={{ display: 'contents' }}>

                {sellError && (
                  <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #FECACA' }}>
                    ⚠️ {sellError}
                  </div>
                )}

                {/* Stock badge */}
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', borderRadius: '20px', padding: '0.2rem 0.75rem', fontSize: '0.78rem', fontWeight: 700 }}>
                    📦 المخزون الحالي: {quickSellProduct.stock} قطعة
                  </span>
                  {(quickSellProduct.unitsPerPackage || 1) > 1 && (
                    <span style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '0.2rem 0.75rem', fontSize: '0.78rem', fontWeight: 700 }}>
                      📦 الشليف = {quickSellProduct.unitsPerPackage} قطعة
                    </span>
                  )}
                </div>

                {/* Unit type toggle (only if package exists) */}
                {(quickSellProduct.unitsPerPackage || 1) > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleUnitChange('piece')}
                      style={{
                        flex: 1, padding: '0.45rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
                        border: '2px solid', cursor: 'pointer', transition: 'all .15s',
                        background: sellUnitType === 'piece' ? '#166534' : '#F8FAFC',
                        color: sellUnitType === 'piece' ? '#fff' : '#475569',
                        borderColor: sellUnitType === 'piece' ? '#166534' : '#CBD5E1',
                      }}
                    >قطعة</button>
                    <button
                      type="button"
                      onClick={() => handleUnitChange('package')}
                      style={{
                        flex: 1, padding: '0.45rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
                        border: '2px solid', cursor: 'pointer', transition: 'all .15s',
                        background: sellUnitType === 'package' ? '#166534' : '#F8FAFC',
                        color: sellUnitType === 'package' ? '#fff' : '#475569',
                        borderColor: sellUnitType === 'package' ? '#166534' : '#CBD5E1',
                      }}
                    >{quickSellProduct.packageUnitName || 'شليف'}</button>
                  </div>
                )}

                {/* Qty + Price Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">الكمية *</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button type="button" onClick={() => setSellQty(q => Math.max(1, q - 1))}
                        style={{ background: '#F1F5F9', border: '1.5px solid #CBD5E1', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FiMinus size={14} />
                      </button>
                      <input
                        type="number" min="1" required
                        className="form-control-custom"
                        style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05rem' }}
                        value={sellQty}
                        onChange={e => setSellQty(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <button type="button" onClick={() => setSellQty(q => q + 1)}
                        style={{ background: '#F1F5F9', border: '1.5px solid #CBD5E1', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FiPlus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">سعر البيع ({settings.currency}) *</label>
                    <input
                      type="number" min="0" step="any" required
                      className="form-control-custom"
                      style={{ fontWeight: 700 }}
                      value={sellPriceInput}
                      onChange={e => setSellPriceInput(e.target.value)}
                    />
                  </div>
                </div>

                {/* Payment type */}
                <div className="form-group">
                  <label className="form-label">نوع الدفع</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['full','partial','debt'] as const).map(pt => (
                      <button key={pt} type="button" onClick={() => setSellPaymentType(pt)}
                        style={{
                          flex: 1, padding: '0.4rem 0.3rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                          border: '2px solid', cursor: 'pointer', transition: 'all .15s',
                          background: sellPaymentType === pt ? (pt === 'full' ? '#166534' : pt === 'partial' ? '#B45309' : '#9F1239') : '#F8FAFC',
                          color: sellPaymentType === pt ? '#fff' : '#475569',
                          borderColor: sellPaymentType === pt ? (pt === 'full' ? '#166534' : pt === 'partial' ? '#B45309' : '#9F1239') : '#CBD5E1',
                        }}
                      >{pt === 'full' ? '✅ كامل' : pt === 'partial' ? '🔸 جزئي' : '⏳ آجل'}</button>
                    ))}
                  </div>
                </div>

                {/* Partial paid amount */}
                {sellPaymentType === 'partial' && (
                  <div className="form-group">
                    <label className="form-label">المبلغ المدفوع ({settings.currency})</label>
                    <input
                      type="number" min="0" step="any"
                      className="form-control-custom"
                      placeholder={`من ${quickTotalAmount.toLocaleString()}`}
                      value={sellPaidInput}
                      onChange={e => setSellPaidInput(e.target.value)}
                    />
                  </div>
                )}

                {/* Customer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">
                      اسم العميل {sellPaymentType !== 'full' ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      className="form-control-custom"
                      placeholder="عميل نقدي"
                      value={sellCustomerName}
                      onChange={e => setSellCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم الهاتف</label>
                    <input
                      type="text"
                      className="form-control-custom"
                      placeholder="07xxxxxxxx"
                      value={sellCustomerPhone}
                      onChange={e => setSellCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات (اختياري)</label>
                  <input
                    type="text"
                    className="form-control-custom"
                    placeholder="ملاحظة على الفاتورة..."
                    value={sellNotes}
                    onChange={e => setSellNotes(e.target.value)}
                  />
                </div>

                {/* Live Totals Panel */}
                <div style={{
                  background: 'linear-gradient(135deg,#F0FDF4,#ECFDF5)',
                  border: '1.5px solid #BBF7D0',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem 1rem',
                }}>
                  <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>الإجمالي</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', textAlign: 'left' }}>
                    {quickTotalAmount.toLocaleString()} {settings.currency}
                  </div>
                  {sellPaymentType !== 'full' && (
                    <>
                      <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>المدفوع</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#166534', textAlign: 'left' }}>
                        {(sellPaymentType === 'partial' ? (parseFloat(sellPaidInput) || 0) : 0).toLocaleString()} {settings.currency}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#B45309', fontWeight: 600 }}>المتبقي (دين)</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#9F1239', textAlign: 'left' }}>
                        {Math.max(0, quickTotalAmount - (sellPaymentType === 'partial' ? (parseFloat(sellPaidInput) || 0) : 0)).toLocaleString()} {settings.currency}
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>الربح المتوقع</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: quickProfit >= 0 ? '#166534' : '#DC2626', textAlign: 'left' }}>
                    {quickProfit >= 0 ? '+' : ''}{quickProfit.toLocaleString()} {settings.currency}
                  </div>
                  {quickIsPkg && (
                    <>
                      <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, gridColumn: '1/-1', borderTop: '1px dashed #A7F3D0', paddingTop: '0.4rem' }}>
                        يُعادل {quickPiecesNeeded} قطعة من المخزن
                      </div>
                    </>
                  )}
                </div>

              </form>
            </div>

            {/* Footer */}
            <div style={{
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid #E2E8F0',
              display: 'flex', gap: '0.65rem', justifyContent: 'flex-end',
              background: '#F8FAFC',
              flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={() => setQuickSellProduct(null)}
                className="btn-outline-custom"
              >إلغاء</button>
              <button
                type="submit"
                form="quick-sell-form"
                className="btn-primary-custom"
                style={{ background: '#166534', borderColor: '#166534', fontWeight: 800, minWidth: '120px' }}
              >
                <FiCheck size={16} /> تأكيد البيع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
           Quick Sale Invoice Preview
          ════════════════════════════════════════════ */}
      {completedQuickSale && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2200, direction: 'rtl',
            animation: 'fadeIn 0.18s ease',
          }}
          onClick={() => setCompletedQuickSale(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', maxHeight: '92vh', overflow: 'auto' }}>
            <SaleInvoice
              sale={completedQuickSale}
              settings={settings}
              isNewSale={true}
              onClose={() => setCompletedQuickSale(null)}
              onNewSale={() => setCompletedQuickSale(null)}
            />
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: toastMsg.ok ? '#166534' : '#9F1239',
          color: '#fff', padding: '0.75rem 1.4rem',
          borderRadius: '50px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          fontSize: '0.88rem', fontWeight: 700, zIndex: 2300,
          animation: 'fadeIn 0.2s ease',
          maxWidth: '90vw', textAlign: 'center',
        }}>
          {toastMsg.text}
        </div>
      )}

    </div>
  );
}
