// ==========================================
// TYPES — نظام إدارة المخزن والمبيعات المبسط
// ==========================================

export interface SimpleProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  _syncPending?: boolean;
  // مستويات التعبئة والبيع الإضافية (مثل شليف، كرتون، درزن)
  hasPackageUnit?: boolean;
  packageUnitName?: string;
  unitsPerPackage?: number;
  packageSellPrice?: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitType?: 'piece' | 'package';
  unitName?: string;
  unitsPerPackage?: number;
  piecesCount?: number;
  sellPrice: number;
  costPrice: number;
  subtotal: number;
  profit: number;
}

export interface DebtPayment {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface SaleRecord {
  id: string;
  invoiceNumber: string;
  items: SaleItem[];
  totalAmount: number;
  totalProfit: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  _syncPending?: boolean;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  dueDate?: string;
  paymentHistory?: DebtPayment[];
  isArchived?: boolean;
  archivedAt?: string;
}

export interface AppSettings {
  storeName: string;
  currency: string;
  adminUsername?: string;
  adminPassword: string;
  googleSheetUrl?: string;
  appsScriptUrl?: string;
  lastSyncedAt?: string;
}

// ── المصاريف النثرية ────────────────────────────────────
export interface Expense {
  id: string;
  title: string;           // اسم المصروف (نقل، إيجار، كهرباء...)
  amount: number;          // المبلغ
  category: string;        // التصنيف
  date: string;            // YYYY-MM-DD
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  _syncPending?: boolean;
}

export const EXPENSE_CATEGORIES = [
  '🚛 نقل وشحن',
  '🏢 إيجار',
  '⚡ كهرباء ومياه',
  '📱 اتصالات وإنترنت',
  '👷 رواتب وأجور',
  '🛒 مستلزمات مكتبية',
  '🔧 صيانة وإصلاح',
  '📦 تغليف',
  '💰 أخرى',
] as const;

// ── Backwards-compatible Types for mockData & legacy pages ──
export type MovementType =
  | 'PURCHASE_RECEIPT'
  | 'SALE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | string;

export interface Product {
  id: string;
  nameAr: string;
  nameEn?: string;
  categoryId?: string;
  subCategoryId?: string;
  baseUnitId?: string;
  hasExpiry?: boolean;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  [key: string]: any;
}

export interface ProductVariant {
  id: string;
  productId: string;
  size?: string;
  color?: string;
  barcode: string;
  minStock: number;
  reorderPoint: number;
  isActive: boolean;
  [key: string]: any;
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn?: string;
  parentId?: string;
  [key: string]: any;
}

export interface Warehouse {
  id: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  isActive: boolean;
  [key: string]: any;
}

export interface Supplier {
  id: string;
  nameAr: string;
  nameEn?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  isActive?: boolean;
  country?: string;
  preferredCurrency?: string;
  [key: string]: any;
}

export interface StockLevel {
  id: string;
  variantId: string;
  warehouseId: string;
  locationId?: string;
  batchNumber?: string;
  expiryDate?: string;
  quantityOnHand?: number;
  quantityReserved?: number;
  quantityAvailable?: number;
  quantity: number;
  [key: string]: any;
}

export interface InventoryMovement {
  id: string;
  movementType: MovementType;
  variantId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  batchNumber?: string;
  expiryDate?: string;
  performedBy?: string;
  notes?: string;
  createdAt: string;
  locationId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  [key: string]: any;
}

export interface PurchaseOrder {
  id: string;
  poNumber?: string;
  supplierId: string;
  warehouseId?: string;
  orderDate: string;
  expectedDate?: string;
  status: 'draft' | 'sent' | 'partial' | 'complete' | 'cancelled';
  totalAmount?: number;
  currency: string;
  notes?: string;
  createdAt: string;
  exchangeRate: number;
  [key: string]: any;
}

export interface Alert {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  variantId?: string;
  [key: string]: any;
}

export interface DashboardStats {
  totalInventoryValue?: number;
  totalProductsCount?: number;
  totalOrdersThisMonth?: number;
  inventoryTurnoverRate?: number;
  totalProducts?: number;
  [key: string]: any;
}

export interface RecentMovement {
  id: string;
  type?: MovementType;
  movementType?: MovementType;
  productName: string;
  variantInfo?: string;
  variantLabel?: string;
  warehouseName?: string;
  quantity: number;
  createdAt: string;
  [key: string]: any;
}
