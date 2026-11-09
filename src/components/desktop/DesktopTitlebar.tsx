import React, { useState, useEffect } from 'react';
import { isElectronApp, desktopWindow } from '../../services/desktopService';
import { VscChromeMinimize, VscChromeMaximize, VscChromeRestore, VscChromeClose } from 'react-icons/vsc';
import { FaBoxes } from 'react-icons/fa';

export const DesktopTitlebar: React.FC = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const runningInElectron = isElectronApp();
    setIsElectron(runningInElectron);

    if (runningInElectron) {
      desktopWindow.isMaximized().then(setIsMaximized);
      const unsubscribe = desktopWindow.onMaximizeChange((max) => {
        setIsMaximized(max);
      });
      return unsubscribe;
    }
  }, []);

  // Only render if running as an Electron desktop app
  if (!isElectron) return null;

  return (
    <header className="desktop-titlebar" aria-label="شريط عنوان التطبيق">
      {/* App Branding & Logo */}
      <div className="titlebar-drag-region titlebar-brand">
        <div className="titlebar-logo">
          <FaBoxes className="text-primary" />
        </div>
        <span className="titlebar-title">نظام إدارة المخازن والمبيعات</span>
        <span className="titlebar-badge">تطبيق سطح المكتب</span>
      </div>

      {/* Center Draggable Space */}
      <div className="titlebar-drag-region titlebar-spacer" />

      {/* Native Windows Control Buttons */}
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn titlebar-minimize"
          onClick={desktopWindow.minimize}
          title="تصغير"
          aria-label="تصغير النافذة"
        >
          <VscChromeMinimize size={14} />
        </button>

        <button
          type="button"
          className="titlebar-btn titlebar-maximize"
          onClick={desktopWindow.maximize}
          title={isMaximized ? 'استعادة' : 'تكبير'}
          aria-label={isMaximized ? 'استعادة حجم النافذة' : 'تكبير النافذة'}
        >
          {isMaximized ? <VscChromeRestore size={14} /> : <VscChromeMaximize size={13} />}
        </button>

        <button
          type="button"
          className="titlebar-btn titlebar-close"
          onClick={desktopWindow.close}
          title="إغلاق"
          aria-label="إغلاق التطبيق"
        >
          <VscChromeClose size={15} />
        </button>
      </div>
    </header>
  );
};

export default DesktopTitlebar;
