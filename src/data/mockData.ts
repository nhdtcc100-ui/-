// ==========================================
// MOCK DATA — بيانات تجريبية
// ==========================================
import type {
  Product, ProductVariant, Category, Warehouse,
  Supplier, StockLevel, InventoryMovement,
  PurchaseOrder, Alert, DashboardStats, RecentMovement,
} from '../types';

export const mockCategories: Category[] = [
  { id: 'cat-1', nameAr: 'ملابس', nameEn: 'Clothing' },
  { id: 'cat-2', nameAr: 'منتجات منزلية', nameEn: 'Home Products' },
  { id: 'cat-3', nameAr: 'مواد تجميل', nameEn: 'Beauty Products' },
  { id: 'cat-1-1', nameAr: 'ملابس رجالية', nameEn: 'Men Clothing', parentId: 'cat-1' },
  { id: 'cat-1-2', nameAr: 'ملابس نسائية', nameEn: 'Women Clothing', parentId: 'cat-1' },
  { id: 'cat-2-1', nameAr: 'أدوات المطبخ', nameEn: 'Kitchen Tools', parentId: 'cat-2' },
  { id: 'cat-3-1', nameAr: 'العناية بالشعر', nameEn: 'Hair Care', parentId: 'cat-3' },
];

export const mockWarehouses: Warehouse[] = [
  { id: 'wh-1', nameAr: 'المخزن الرئيسي', nameEn: 'Main Warehouse', address: 'بغداد، العراق', isActive: true },
  { id: 'wh-2', nameAr: 'مخزن الفرع الأول', nameEn: 'Branch 1', address: 'البصرة، العراق', isActive: true },
];

export const mockProducts: Product[] = [
  {
    id: 'prod-1', nameAr: 'قميص رجالي كاجوال', nameEn: 'Men Casual Shirt',
    categoryId: 'cat-1-1', subCategoryId: 'cat-1-1', baseUnitId: 'unit-1',
    hasExpiry: false, isActive: true, createdAt: '2026-09-01',
    description: 'قميص رجالي عالي الجودة متوفر بألوان متعددة',
  },
  {
    id: 'prod-2', nameAr: 'شامبو أرجان 500ml', nameEn: 'Argan Shampoo 500ml',
    categoryId: 'cat-3-1', subCategoryId: 'cat-3-1', baseUnitId: 'unit-1',
    hasExpiry: true, isActive: true, createdAt: '2026-09-05',
  },
  {
    id: 'prod-3', nameAr: 'كريم ترطيب Ultra', nameEn: 'Ultra Moisturizing Cream',
    categoryId: 'cat-3', subCategoryId: 'cat-3', baseUnitId: 'unit-1',
    hasExpiry: true, isActive: true, createdAt: '2026-09-10',
  },
  {
    id: 'prod-4', nameAr: 'طقم أدوات مطبخ', nameEn: 'Kitchen Tool Set',
    categoryId: 'cat-2-1', subCategoryId: 'cat-2-1', baseUnitId: 'unit-2',
    hasExpiry: false, isActive: true, createdAt: '2026-09-15',
  },
  {
    id: 'prod-5', nameAr: 'فستان نسائي صيفي', nameEn: 'Women Summer Dress',
    categoryId: 'cat-1-2', subCategoryId: 'cat-1-2', baseUnitId: 'unit-1',
    hasExpiry: false, isActive: true, createdAt: '2026-09-20',
  },
];

export const mockVariants: ProductVariant[] = [
  { id: 'var-1', productId: 'prod-1', size: 'S', color: 'أسود', barcode: '6291001234561', minStock: 10, reorderPoint: 15, isActive: true },
  { id: 'var-2', productId: 'prod-1', size: 'M', color: 'أسود', barcode: '6291001234562', minStock: 10, reorderPoint: 15, isActive: true },
  { id: 'var-3', productId: 'prod-1', size: 'L', color: 'أسود', barcode: '6291001234563', minStock: 10, reorderPoint: 15, isActive: true },
  { id: 'var-4', productId: 'prod-1', size: 'M', color: 'أبيض', barcode: '6291001234564', minStock: 10, reorderPoint: 15, isActive: true },
  { id: 'var-5', productId: 'prod-2', barcode: '6291001234565', minStock: 20, reorderPoint: 30, isActive: true },
  { id: 'var-6', productId: 'prod-3', barcode: '6291001234566', minStock: 15, reorderPoint: 20, isActive: true },
  { id: 'var-7', productId: 'prod-4', barcode: '6291001234567', minStock: 5, reorderPoint: 8, isActive: true },
  { id: 'var-8', productId: 'prod-5', size: 'S', color: 'أحمر', barcode: '6291001234568', minStock: 8, reorderPoint: 12, isActive: true },
];

export const mockStockLevels: StockLevel[] = [
  { id: 'sl-1', variantId: 'var-1', warehouseId: 'wh-1', locationId: 'loc-1', batchNumber: 'B-2026-001', quantity: 45, unitId: 'unit-1' },
  { id: 'sl-2', variantId: 'var-2', warehouseId: 'wh-1', locationId: 'loc-1', batchNumber: 'B-2026-001', quantity: 3, unitId: 'unit-1' },
  { id: 'sl-3', variantId: 'var-3', warehouseId: 'wh-1', locationId: 'loc-2', batchNumber: 'B-2026-001', quantity: 30, unitId: 'unit-1' },
  { id: 'sl-4', variantId: 'var-4', warehouseId: 'wh-1', locationId: 'loc-1', batchNumber: 'B-2026-001', quantity: 22, unitId: 'unit-1' },
  { id: 'sl-5', variantId: 'var-5', warehouseId: 'wh-1', locationId: 'loc-3', batchNumber: 'B-2026-002', quantity: 80, unitId: 'unit-1', expiryDate: '2027-06-01' },
  { id: 'sl-6', variantId: 'var-6', warehouseId: 'wh-1', locationId: 'loc-4', batchNumber: 'B-2026-003', quantity: 12, unitId: 'unit-1', expiryDate: '2026-11-01' },
  { id: 'sl-7', variantId: 'var-7', warehouseId: 'wh-1', locationId: 'loc-5', batchNumber: 'B-2026-004', quantity: 18, unitId: 'unit-2' },
  { id: 'sl-8', variantId: 'var-8', warehouseId: 'wh-1', locationId: 'loc-2', batchNumber: 'B-2026-005', quantity: 6, unitId: 'unit-1' },
];

export const mockSuppliers: Supplier[] = [
  { id: 'sup-1', nameAr: 'شركة الأمل للتوريد', nameEn: 'Al-Amal Trading', phone: '07701234567', email: 'amal@trading.iq', country: 'العراق', preferredCurrency: 'IQD', isActive: true },
  { id: 'sup-2', nameAr: 'مورد التجميل الذهبي', nameEn: 'Golden Beauty Supplier', phone: '07809876543', country: 'العراق', preferredCurrency: 'IQD', isActive: true },
  { id: 'sup-3', nameAr: 'شركة الملابس الراقية', nameEn: 'Premium Fashion Co.', phone: '07712345678', country: 'تركيا', preferredCurrency: 'USD', isActive: true },
];

export const mockPurchaseOrders: PurchaseOrder[] = [
  { id: 'PO-0047', supplierId: 'sup-1', orderDate: '2026-10-01', currency: 'IQD', exchangeRate: 1, status: 'partial', discount: 0, taxRate: 15, createdBy: 'admin', createdAt: '2026-10-01T09:00:00' },
  { id: 'PO-0046', supplierId: 'sup-2', orderDate: '2026-09-28', currency: 'IQD', exchangeRate: 1, status: 'complete', discount: 25000, taxRate: 15, createdBy: 'admin', createdAt: '2026-09-28T10:30:00' },
  { id: 'PO-0045', supplierId: 'sup-3', orderDate: '2026-09-20', currency: 'USD', exchangeRate: 1305, status: 'complete', discount: 0, taxRate: 0, createdBy: 'admin', createdAt: '2026-09-20T14:00:00' },
  { id: 'PO-0044', supplierId: 'sup-1', orderDate: '2026-09-10', currency: 'IQD', exchangeRate: 1, status: 'draft', discount: 0, taxRate: 15, createdBy: 'admin', createdAt: '2026-09-10T11:00:00' },
];

export const mockMovements: InventoryMovement[] = [
  { id: 'mv-1', movementType: 'PURCHASE_RECEIPT', variantId: 'var-1', warehouseId: 'wh-1', locationId: 'loc-1', quantity: 100, unitId: 'unit-1', balanceBefore: 0, balanceAfter: 100, referenceType: 'GRN', referenceId: 'GRN-001', createdBy: 'admin', createdAt: '2026-10-01T09:30:00', batchNumber: 'B-2026-001' },
  { id: 'mv-2', movementType: 'SALE', variantId: 'var-1', warehouseId: 'wh-1', locationId: 'loc-1', quantity: -20, unitId: 'unit-1', balanceBefore: 100, balanceAfter: 80, referenceType: 'SALE_ORDER', referenceId: 'SO-101', createdBy: 'admin', createdAt: '2026-10-02T14:00:00', batchNumber: 'B-2026-001' },
  { id: 'mv-3', movementType: 'TRANSFER_OUT', variantId: 'var-2', warehouseId: 'wh-1', locationId: 'loc-1', quantity: -15, unitId: 'unit-1', balanceBefore: 18, balanceAfter: 3, referenceType: 'TRANSFER', referenceId: 'TR-011', createdBy: 'admin', createdAt: '2026-10-02T16:00:00', batchNumber: 'B-2026-001' },
  { id: 'mv-4', movementType: 'DAMAGE', variantId: 'var-5', warehouseId: 'wh-1', locationId: 'loc-3', quantity: -5, unitId: 'unit-1', balanceBefore: 85, balanceAfter: 80, notes: 'تلف أثناء النقل', createdBy: 'admin', createdAt: '2026-10-03T10:00:00', batchNumber: 'B-2026-002' },
  { id: 'mv-5', movementType: 'PURCHASE_RECEIPT', variantId: 'var-6', warehouseId: 'wh-1', locationId: 'loc-4', quantity: 30, unitId: 'unit-1', balanceBefore: 0, balanceAfter: 30, referenceType: 'GRN', referenceId: 'GRN-002', createdBy: 'admin', createdAt: '2026-09-28T11:00:00', batchNumber: 'B-2026-003' },
];

export const mockAlerts: Alert[] = [
  { id: 'al-1', type: 'low_stock', variantId: 'var-2', message: 'قميص رجالي أسود - M: الكمية 3 (الحد الأدنى: 10)', isRead: false, createdAt: '2026-10-03T08:00:00' },
  { id: 'al-2', type: 'expiry_near', variantId: 'var-6', message: 'كريم ترطيب Ultra: ينتهي خلال 29 يوماً', isRead: false, createdAt: '2026-10-03T08:00:00' },
  { id: 'al-3', type: 'low_stock', variantId: 'var-8', message: 'فستان نسائي أحمر - S: الكمية 6 (الحد الأدنى: 8)', isRead: false, createdAt: '2026-10-03T08:00:00' },
  { id: 'al-4', type: 'expiry_near', variantId: 'var-5', message: 'شامبو أرجان 500ml: ينتهي خلال 60 يوماً', isRead: true, createdAt: '2026-10-02T08:00:00' },
];

export const mockDashboardStats: DashboardStats = {
  totalProducts: 24,
  lowStockCount: 3,
  totalStockValue: 4200000,
  monthlyPurchases: 850000,
  alertsCount: 3,
};

export const mockRecentMovements: RecentMovement[] = [
  { id: 'mv-1', movementType: 'PURCHASE_RECEIPT', productName: 'قميص رجالي كاجوال', variantLabel: 'أسود - S', quantity: 100, createdAt: '2026-10-01T09:30:00' },
  { id: 'mv-2', movementType: 'SALE', productName: 'قميص رجالي كاجوال', variantLabel: 'أسود - S', quantity: -20, createdAt: '2026-10-02T14:00:00' },
  { id: 'mv-3', movementType: 'TRANSFER_OUT', productName: 'قميص رجالي كاجوال', variantLabel: 'أسود - M', quantity: -15, createdAt: '2026-10-02T16:00:00' },
  { id: 'mv-4', movementType: 'DAMAGE', productName: 'شامبو أرجان 500ml', variantLabel: '', quantity: -5, createdAt: '2026-10-03T10:00:00' },
];
