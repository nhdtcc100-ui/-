import type { SimpleProduct, SaleRecord } from './index';

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  imported?: number;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;

  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
  };

  printer: {
    getPrinters: () => Promise<PrinterInfo[]>;
    printReceipt: (
      htmlContent: string,
      options?: { silent?: boolean; deviceName?: string; pageSize?: string }
    ) => Promise<{ success: boolean; error?: string }>;
    printDirect: (options?: {
      silent?: boolean;
      deviceName?: string;
    }) => Promise<{ success: boolean; error?: string }>;
  };

  fs: {
    saveFile: (options: {
      defaultName: string;
      content: string | ArrayBuffer;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
    openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  };

  notifications: {
    show: (title: string, body: string, type?: 'info' | 'warning' | 'error') => void;
  };

  app: {
    getVersion: () => Promise<string>;
    openExternal: (url: string) => void;
  };

  // ── قاعدة البيانات المحلية ──────────────────────────────────
  db: {
    products: {
      getAll:       ()                              => Promise<IpcResult<SimpleProduct[]>>;
      getById:      (id: string)                    => Promise<IpcResult<SimpleProduct>>;
      getByBarcode: (barcode: string)               => Promise<IpcResult<SimpleProduct>>;
      upsert:       (product: SimpleProduct)        => Promise<IpcResult<SimpleProduct>>;
      delete:       (id: string)                    => Promise<IpcResult<void>>;
      updateStock:  (id: string, stock: number)     => Promise<IpcResult<SimpleProduct>>;
      bulkUpsert:   (products: SimpleProduct[])     => Promise<IpcResult<void>>;
    };
    sales: {
      getAll:     ()                   => Promise<IpcResult<SaleRecord[]>>;
      getById:    (id: string)         => Promise<IpcResult<SaleRecord>>;
      upsert:     (sale: SaleRecord)   => Promise<IpcResult<SaleRecord>>;
      delete:     (id: string)         => Promise<IpcResult<void>>;
      bulkUpsert: (sales: SaleRecord[]) => Promise<IpcResult<void>>;
    };
    settings: {
      get:    (key: string)             => Promise<IpcResult<any>>;
      set:    (key: string, value: any) => Promise<IpcResult<void>>;
      getAll: ()                        => Promise<IpcResult<Record<string, any>>>;
    };
    stats: {
      dashboard: (userId?: string) => Promise<IpcResult<{
        productsCount: number;
        lowStockCount: number;
        totalInventoryValue: number;
        today: { revenue: number; profit: number; count: number };
        thisMonth: { revenue: number; profit: number; count: number };
      }>>;
    };
  };

  server?: {
    getInfo: () => Promise<{
      isRunning: boolean;
      localIp: string;
      port: number;
      url: string;
    }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

