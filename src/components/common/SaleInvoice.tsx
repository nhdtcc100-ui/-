import {
  FiPrinter, FiCheckCircle, FiPlus, FiX
} from 'react-icons/fi';
import type { SaleRecord, AppSettings } from '../../types';

interface SaleInvoiceProps {
  sale: SaleRecord;
  settings: AppSettings;
  isNewSale?: boolean;
  onClose?: () => void;
  onNewSale?: () => void;
}

export default function SaleInvoice({
  sale,
  settings,
  isNewSale = false,
  onClose,
  onNewSale,
}: SaleInvoiceProps) {

  const handlePrint = () => {
    // Build a self-contained HTML page for the invoice
    const logoUrl = `${window.location.origin}/logo.jpg`;
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>فاتورة ${sale.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      background: #fff;
      color: #0F172A;
      padding: 24px 28px;
      direction: rtl;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4; margin: 14mm 16mm; }

    /* ── Header ── */
    .inv-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px dashed #CBD5E1;
      padding-bottom: 18px;
      margin-bottom: 18px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .inv-logo-wrap { display: flex; align-items: center; gap: 12px; }
    .inv-logo {
      width: 64px; height: 64px;
      border-radius: 14px;
      object-fit: cover;
      border: 1.5px solid #E2E8F0;
      box-shadow: 0 4px 10px rgba(0,0,0,0.08);
    }
    .inv-store-name { font-size: 1.3rem; font-weight: 900; color: #0F172A; }
    .inv-type { font-size: 0.8rem; color: #64748B; margin-top: 3px; }
    .inv-meta { text-align: left; min-width: 160px; }
    .inv-num {
      display: inline-block;
      background: #EFF6FF;
      color: #1D4ED8;
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 800;
      border: 1px solid #BFDBFE;
      margin-bottom: 5px;
    }
    .inv-date { font-size: 0.78rem; color: #475569; }

    /* ── Customer Box ── */
    .inv-customer {
      background: #F8FAFC;
      border: 1.5px solid #E2E8F0;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 18px;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      font-size: 0.85rem;
    }
    .inv-customer span { color: #64748B; font-weight: 600; }
    .inv-customer strong { color: #0F172A; }

    /* ── Items Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      margin-bottom: 18px;
    }
    thead tr { background: #F1F5F9; }
    th {
      padding: 9px 10px;
      text-align: right;
      font-weight: 800;
      color: #334155;
      border: 1.5px solid #CBD5E1;
      background: #F1F5F9 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    td {
      padding: 9px 10px;
      border: 1px solid #E2E8F0;
      vertical-align: middle;
    }
    .td-center { text-align: center; }
    .td-left  { text-align: left; }
    tbody tr:nth-child(even) { background: #FAFAFA; }
    tfoot tr { background: #F8FAFC !important; border-top: 2px solid #94A3B8; }
    tfoot td { font-size: 1rem; font-weight: 800; }
    .total-amount { font-size: 1.25rem; font-weight: 900; color: #1D4ED8; }

    /* ── Footer ── */
    .inv-footer {
      text-align: center;
      font-size: 0.8rem;
      color: #64748B;
      border-top: 1px solid #E2E8F0;
      padding-top: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="inv-header">
    <div class="inv-logo-wrap">
      <img class="inv-logo" src="${logoUrl}" alt="شعار" onerror="this.style.display='none'"/>
      <div>
        <div class="inv-store-name">${settings.storeName || 'مخزن ميثم'}</div>
        <div class="inv-type">فاتورة مبيعات نقدية</div>
      </div>
    </div>
    <div class="inv-meta">
      <div class="inv-num">${sale.invoiceNumber}</div>
      <div class="inv-date">
        ${new Date(sale.createdAt || Date.now()).toLocaleString('ar-IQ', {
          year: 'numeric', month: 'numeric', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })}
      </div>
    </div>
  </div>

  <div class="inv-customer">
    <div><span>العميل: </span><strong>${sale.customerName || 'عميل نقدي'}</strong></div>
    ${sale.notes ? `<div><span>ملاحظات: </span><strong>${sale.notes}</strong></div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>الصنف / المنتج</th>
        <th class="td-center">الوحدة</th>
        <th class="td-center">الكمية</th>
        <th class="td-center">السعر</th>
        <th class="td-left">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${(sale.items && sale.items.length > 0) ? sale.items.map(item => `
        <tr>
          <td><strong>${item.productName}</strong></td>
          <td class="td-center" style="font-size:0.78rem;color:#64748B;">
            ${item.unitType === 'package'
              ? `${item.unitName || 'طرد'}${item.unitsPerPackage ? ` (${item.unitsPerPackage} ق)` : ''}`
              : 'قطعة'}
          </td>
          <td class="td-center"><strong>${item.quantity}</strong></td>
          <td class="td-center">${item.sellPrice.toLocaleString()} ${settings.currency}</td>
          <td class="td-left"><strong>${item.subtotal.toLocaleString()} ${settings.currency}</strong></td>
        </tr>
      `).join('') : `
        <tr>
          <td colspan="5" class="td-center" style="padding:1rem;color:#64748B;">
            ${sale.notes || 'بضاعة عامة'} — الإجمالي: ${sale.totalAmount.toLocaleString()} ${settings.currency}
          </td>
        </tr>
      `}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3"><strong>المجموع الكلي المطلوب:</strong></td>
        <td colspan="2" class="td-left">
          <span class="total-amount">${sale.totalAmount.toLocaleString()} ${settings.currency}</span>
        </td>
      </tr>
    </tfoot>
  </table>

  <div class="inv-footer">شكراً لتعاملكم معنا — نتطلع لخدمتكم دائماً ✨</div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 400);
    };
  </script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=850,height=700');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto' }}>

      {/* Success Notification Banner (Only for newly completed sales) */}
      {isNewSale && (
        <div className="no-print" style={{
          textAlign: 'center',
          background: '#F0FDF4',
          border: '1.5px solid #BBF7D0',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '1.25rem',
          boxShadow: 'var(--clay-card-shadow)'
        }}>
          <div style={{ color: '#16A34A', marginBottom: '0.4rem' }}>
            <FiCheckCircle size={44} />
          </div>
          <h3 style={{ margin: 0, fontWeight: 800, color: '#166534', fontSize: '1.15rem' }}>
            تمت عملية البيع وخصم المخزون بنجاح!
          </h3>
          <p style={{ margin: '0.25rem 0 0.5rem', color: '#15803D', fontSize: '0.84rem' }}>
            تم خصم الكميات من المخزن وحفظ الفاتورة برقم <strong>{sale.invoiceNumber}</strong>
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: '#DCFCE7',
            color: '#15803D',
            padding: '0.3rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 700,
          }}>
            <span>📊 تم التحديث الفوري في النظام</span>
          </div>
        </div>
      )}

      {/* Printable Invoice Card (screen preview only) */}
      <div className="printable-invoice-card clay-card" style={{
        background: '#FFFFFF',
        padding: '2rem',
        borderRadius: 'var(--radius-xl)',
        border: '1.5px solid #E2E8F0',
        direction: 'rtl',
      }}>

        {/* Invoice Header: Logo & Store Info */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px dashed #E2E8F0',
          paddingBottom: '1.25rem',
          marginBottom: '1.25rem',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <img
              src="/logo.jpg"
              alt="شعار"
              style={{
                width: 62,
                height: 62,
                borderRadius: '14px',
                objectFit: 'cover',
                border: '1.5px solid #E2E8F0',
                boxShadow: '0 4px 10px rgba(160, 175, 205, 0.2)'
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                {settings.storeName || 'مخزن ميثم'}
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.2rem' }}>
                فاتورة مبيعات نقدية
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'left', minWidth: '160px' }}>
            <div style={{
              background: '#EFF6FF',
              color: '#1D4ED8',
              padding: '0.25rem 0.65rem',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'inline-block',
              marginBottom: '0.35rem',
              border: '1px solid #BFDBFE'
            }}>
              {sale.invoiceNumber}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
              {new Date(sale.createdAt || Date.now()).toLocaleString('ar-IQ', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        {/* Customer & Notes Info */}
        <div style={{
          background: '#F8FAFC',
          border: '1.5px solid #E2E8F0',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.6rem',
          fontSize: '0.84rem'
        }}>
          <div>
            <span style={{ color: '#64748B', fontWeight: 600 }}>العميل: </span>
            <strong style={{ color: '#0F172A' }}>{sale.customerName || 'عميل نقدي'}</strong>
          </div>
          {sale.notes && (
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>ملاحظات: </span>
              <span style={{ color: '#0F172A' }}>{sale.notes}</span>
            </div>
          )}
        </div>

        {/* Invoice Items Table */}
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.85rem',
          direction: 'rtl',
          marginBottom: '1.25rem'
        }}>
          <thead>
            <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1' }}>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#334155' }}>
                الصنف / المنتج
              </th>
              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 800, color: '#334155' }}>
                الوحدة
              </th>
              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 800, color: '#334155' }}>
                الكمية
              </th>
              <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 800, color: '#334155' }}>
                السعر
              </th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#334155' }}>
                الإجمالي
              </th>
            </tr>
          </thead>
          <tbody>
            {(sale.items && sale.items.length > 0) ? (
              sale.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                    {item.productName}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: '#64748B', fontSize: '0.78rem' }}>
                    {item.unitType === 'package'
                      ? `${item.unitName || 'طرد'} ${item.unitsPerPackage ? `(${item.unitsPerPackage} ق)` : ''}`
                      : 'قطعة'}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: '#334155' }}>
                    {item.sellPrice.toLocaleString()} {settings.currency}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 800, color: '#0F172A' }}>
                    {item.subtotal.toLocaleString()} {settings.currency}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#64748B' }}>
                  {sale.notes || 'بضاعة عامة'} — الإجمالي: {sale.totalAmount.toLocaleString()} {settings.currency}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F8FAFC', borderTop: '2px solid #CBD5E1' }}>
              <td colSpan={3} style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
                المجموع الكلي المطلوب:
              </td>
              <td colSpan={2} style={{ padding: '0.85rem 0.75rem', textAlign: 'left', fontWeight: 900, fontSize: '1.25rem', color: '#2563EB' }}>
                {sale.totalAmount.toLocaleString()} {settings.currency}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Invoice Footer Greeting */}
        <div style={{
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#64748B',
          borderTop: '1px solid #E2E8F0',
          paddingTop: '0.85rem',
          fontWeight: 600
        }}>
          شكراً لتعاملكم معنا — نتطلع لخدمتكم دائماً ✨
        </div>
      </div>

      {/* Action Buttons */}
      <div className="no-print" style={{
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginTop: '1.25rem'
      }}>
        <button
          onClick={handlePrint}
          className="btn-primary-custom"
          style={{ fontWeight: 800, padding: '0.65rem 1.4rem' }}
        >
          <FiPrinter size={17} /> طباعة الفاتورة
        </button>



        {isNewSale && onNewSale && (
          <button
            onClick={onNewSale}
            className="btn-outline-custom"
            style={{ fontWeight: 700 }}
          >
            <FiPlus size={15} /> بيع جديد
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="btn-outline-custom"
            style={{ fontWeight: 700 }}
          >
            <FiX size={15} /> إغلاق
          </button>
        )}
      </div>

    </div>
  );
}
