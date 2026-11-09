/**
 * Desktop & Native OS helper service
 * Gracefully works whether running inside Electron or regular Web Browser.
 */

export const isElectronApp = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
};

export const desktopWindow = {
  minimize: () => {
    if (isElectronApp()) window.electronAPI?.window.minimize();
  },
  maximize: () => {
    if (isElectronApp()) window.electronAPI?.window.maximize();
  },
  close: () => {
    if (isElectronApp()) window.electronAPI?.window.close();
  },
  isMaximized: async (): Promise<boolean> => {
    if (isElectronApp() && window.electronAPI) {
      return await window.electronAPI.window.isMaximized();
    }
    return false;
  },
  onMaximizeChange: (callback: (isMax: boolean) => void) => {
    if (isElectronApp() && window.electronAPI) {
      return window.electronAPI.window.onMaximizeChange(callback);
    }
    return () => {};
  }
};

export const sendNativeNotification = (title: string, body: string, type: 'info' | 'warning' | 'error' = 'info') => {
  if (isElectronApp()) {
    window.electronAPI?.notifications.show(title, body, type);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
};

export const printThermalReceipt = async (
  htmlContent: string,
  options?: { silent?: boolean; deviceName?: string; pageSize?: string }
) => {
  if (isElectronApp() && window.electronAPI) {
    return await window.electronAPI.printer.printReceipt(htmlContent, options);
  } else {
    // Fallback in web browser: open printable iframe/window
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(htmlContent);
      printWin.document.close();
      printWin.focus();
      printWin.print();
      return { success: true };
    }
    return { success: false, error: 'Popup blocked' };
  }
};

export const saveExportedFile = async (
  defaultName: string,
  content: string | ArrayBuffer,
  filters?: Array<{ name: string; extensions: string[] }>
) => {
  if (isElectronApp() && window.electronAPI) {
    return await window.electronAPI.fs.saveFile({ defaultName, content, filters });
  } else {
    // Web fallback: classic browser download trigger
    const blob = typeof content === 'string' ? new Blob([content], { type: 'text/plain;charset=utf-8' }) : new Blob([content]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true };
  }
};
