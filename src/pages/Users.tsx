import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUsers, FiPlus, FiEdit2, FiTrash2, FiKey,
  FiCheck, FiX, FiShield, FiUser, FiEye, FiEyeOff,
} from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../services/supabaseClient';
import type { DbUser } from '../services/dbService';

// ─────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:   { label: 'مدير النظام',   color: '#f59e0b' },
  manager: { label: 'مشرف',          color: '#6366f1' },
  staff:   { label: 'موظف',          color: '#22c55e' },
  viewer:  { label: 'مشاهد فقط',     color: '#64748b' },
};

// ─────────────────────────────────────────────────────────────────
type ModalMode = 'create' | 'edit' | 'password' | null;

interface FormState {
  username: string;
  displayName: string;
  role: string;
  password: string;
  confirmPassword: string;
  pinCode: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  username: '',
  displayName: '',
  role: 'staff',
  password: '',
  confirmPassword: '',
  pinCode: '123456',
  isActive: true,
};

// ─────────────────────────────────────────────────────────────────
export default function Users() {
  const { currentUser, isElectron } = useAuth();
  const navigate = useNavigate();

  // دالة تحويل ملف Supabase إلى DbUser
  const mapProfile = (p: any): DbUser => ({
    id: p.id,
    username: p.username,
    displayName: p.displayName || p.display_name || p.username,
    role: p.role || 'admin',
    pinCode: p.pin_code || p.pinCode || '123456',
    isActive: p.isActive !== false,
    createdAt: p.createdAt || p.created_at || new Date().toISOString(),
  });

  const [users, setUsers]         = useState<DbUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<DbUser | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [showPass, setShowPass]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState('');

  // ── حماية الصفحة ───────────────────────────────────────────────
  useEffect(() => {
    if (!isElectron) { navigate('/dashboard'); return; }
    if (currentUser?.role !== 'admin') { navigate('/dashboard'); return; }
    loadUsers();
  }, [isElectron, currentUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (res.error) throw res.error;
      setUsers((res.data || []).map(mapProfile));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── فتح المودال ────────────────────────────────────────────────
  const openCreate = () => {
    setSelectedUser(null);
    setForm(EMPTY_FORM);
    setModalMode('create');
    setShowPass(false);
  };

  const openEdit = (user: DbUser) => {
    setSelectedUser(user);
    setForm({
      ...EMPTY_FORM,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      pinCode: user.pinCode || '123456',
      isActive: user.isActive,
    });
    setModalMode('edit');
  };

  const openPassword = (user: DbUser) => {
    setSelectedUser(user);
    setForm({ ...EMPTY_FORM, pinCode: user.pinCode || '123456' });
    setModalMode('password');
    setShowPass(false);
  };

  const closeModal = () => { setModalMode(null); setSelectedUser(null); };

  // ── حفظ ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (modalMode === 'create') {
        if (!form.username.trim()) { setError('اسم المستخدم مطلوب'); setSaving(false); return; }
        if (form.password.length < 4) { setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل'); setSaving(false); return; }
        if (form.password !== form.confirmPassword) { setError('كلمات المرور غير متطابقة'); setSaving(false); return; }

        const res = await supabaseService.register({
          username: form.username.trim(),
          password: form.password,
          role: form.role as any,
          displayName: form.displayName.trim(),
          pinCode: form.pinCode.trim() || '123456',
        });
        if (!res.success) { setError(res.message || 'فشل الإنشاء'); setSaving(false); return; }
        showToast('✅ تم إنشاء المستخدم بنجاح');

      } else if (modalMode === 'edit' && selectedUser) {
        const { error } = await supabase.from('profiles').update({
          display_name: form.displayName.trim(),
          role: form.role,
          pin_code: form.pinCode.trim() || '123456',
          updated_at: new Date().toISOString(),
        }).eq('id', selectedUser.id);
        if (error) { setError(error.message || 'فشل التعديل'); setSaving(false); return; }
        showToast('✅ تم تعديل المستخدم والرمز السري');

      } else if (modalMode === 'password' && selectedUser) {
        if (form.password.length < 4) { setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل'); setSaving(false); return; }
        if (form.password !== form.confirmPassword) { setError('كلمات المرور غير متطابقة'); setSaving(false); return; }

        // تغيير كلمة المرور عبر Admin API (يتطلب service role key في backend)
        // بدلاً من ذلك نطلب من المستخدم تغيير كلمة المرور بنفسه
        // هنا نستخدم updateUser للمستخدم الحالي إذا كان هو نفسه
        if (selectedUser.id === currentUser?.id) {
          const res = await supabaseService.changePassword(form.password);
          if (!res.success) { setError(res.message || 'فشل التغيير'); setSaving(false); return; }
        } else {
          setError('لا يمكن تغيير كلمة مرور مستخدم آخر. يجب أن يسجّل دخوله بنفسه ويغيرها من الإعدادات.');
          setSaving(false);
          return;
        }
        showToast('✅ تم تغيير كلمة المرور');
      }

      closeModal();
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── حذف ────────────────────────────────────────────────────────
  const handleDelete = async (user: DbUser) => {
    if (!confirm(`هل تريد حذف المستخدم "${user.displayName || user.username}"؟\nسيتم حذف جميع بياناته!`)) return;
    try {
      // حذف من جدول profiles (ON DELETE CASCADE يحذف بياناته)
      const { error } = await supabase.from('profiles').delete().eq('id', user.id);
      if (error) { showToast('❌ ' + (error.message || 'فشل الحذف')); return; }
      showToast('🗑️ تم حذف المستخدم');
      await loadUsers();
    } catch (e: any) {
      showToast('❌ ' + e.message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="page-container" dir="rtl">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '0.75rem 1.25rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
          animation: 'slideIn 0.2s ease',
        }}>{toast}</div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FiUsers size={24} /> إدارة المستخدمين
          </h1>
          <p className="page-subtitle">إنشاء وتعديل حسابات المستخدمين وصلاحياتهم</p>
        </div>
        <button className="btn-primary" onClick={openCreate} id="btn-create-user">
          <FiPlus size={16} /> مستخدم جديد
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {Object.entries(ROLE_LABELS).map(([role, info]) => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} className="stat-card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: info.color }}>{count}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{info.label}</div>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <div className="setup-spinner" style={{ margin: '0 auto 1rem' }} />
          جارٍ تحميل المستخدمين...
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>اسم العرض</th>
                <th>الدور</th>
                <th>الرمز السري (PIN)</th>
                <th>الحالة</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ opacity: user.isActive ? 1 : 0.5 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: ROLE_LABELS[user.role]?.color + '22',
                        border: `2px solid ${ROLE_LABELS[user.role]?.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: ROLE_LABELS[user.role]?.color,
                      }}>
                        {user.role === 'admin' ? <FiShield size={16} /> : <FiUser size={16} />}
                      </div>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{user.username}</span>
                    </div>
                  </td>
                  <td>{user.displayName || '—'}</td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.7rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: ROLE_LABELS[user.role]?.color + '22',
                      color: ROLE_LABELS[user.role]?.color,
                    }}>
                      {ROLE_LABELS[user.role]?.label || user.role}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      background: 'rgba(37,99,235,0.08)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(37,99,235,0.2)',
                      fontSize: '0.85rem',
                      color: '#2563EB',
                      letterSpacing: '1px'
                    }}>
                      {user.pinCode || '123456'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: user.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: user.isActive ? '#22c55e' : '#ef4444',
                    }}>
                      {user.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {new Date(user.createdAt).toLocaleDateString('ar-IQ')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn-icon"
                        title="تعديل"
                        onClick={() => openEdit(user)}
                        id={`btn-edit-user-${user.id}`}
                      >
                        <FiEdit2 size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        title="تغيير كلمة المرور"
                        onClick={() => openPassword(user)}
                        id={`btn-pass-user-${user.id}`}
                      >
                        <FiKey size={14} />
                      </button>
                      {user.username !== 'admin' && (
                        <button
                          className="btn-icon btn-icon-danger"
                          title="حذف"
                          onClick={() => handleDelete(user)}
                          id={`btn-delete-user-${user.id}`}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      {modalMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-container"
            style={{ maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {modalMode === 'create' && '➕ إضافة مستخدم جديد'}
                {modalMode === 'edit'   && '✏️ تعديل المستخدم'}
                {modalMode === 'password' && '🔑 تغيير كلمة المرور'}
              </h2>
              <button className="btn-icon" onClick={closeModal}><FiX size={18} /></button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', borderRadius: 8, padding: '0.7rem 1rem', fontSize: '0.85rem' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* اسم المستخدم */}
              {modalMode === 'create' && (
                <div className="form-group">
                  <label className="form-label">اسم المستخدم *</label>
                  <input
                    className="form-control-custom"
                    placeholder="مثال: ahmed"
                    value={form.username}
                    onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setError(''); }}
                    dir="ltr"
                    id="input-new-username"
                  />
                </div>
              )}

              {/* اسم العرض */}
              {(modalMode === 'create' || modalMode === 'edit') && (
                <>
                  <div className="form-group">
                    <label className="form-label">اسم العرض</label>
                    <input
                      className="form-control-custom"
                      placeholder="مثال: أحمد محمد"
                      value={form.displayName}
                      onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                      id="input-display-name"
                    />
                  </div>

                  {/* الدور */}
                  <div className="form-group">
                    <label className="form-label">الدور والصلاحيات</label>
                    <select
                      className="form-control-custom"
                      value={form.role}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                      id="select-role"
                    >
                      <option value="admin">مدير النظام — صلاحيات كاملة</option>
                      <option value="manager">مشرف — إدارة المنتجات والمبيعات</option>
                      <option value="staff">موظف — بيع وتسجيل فقط</option>
                      <option value="viewer">مشاهد — عرض فقط بدون تعديل</option>
                    </select>
                  </div>

                  {/* الرمز السري */}
                  <div className="form-group">
                    <label className="form-label">الرمز السري (PIN) *</label>
                    <input
                      className="form-control-custom"
                      type="text"
                      placeholder="123456"
                      value={form.pinCode}
                      onChange={e => { setForm(f => ({ ...f, pinCode: e.target.value })); setError(''); }}
                      id="input-pin-code"
                      dir="ltr"
                      maxLength={15}
                      style={{ fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 700 }}
                    />
                    <small style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                      الرمز السري السريع الخاص بهذا المستخدم (الافتراضي: 123456)
                    </small>
                  </div>

                  {/* الحالة */}
                  {modalMode === 'edit' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        id="chk-active"
                        checked={form.isActive}
                        onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                        style={{ width: 16, height: 16 }}
                      />
                      <label htmlFor="chk-active" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                        الحساب نشط
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* كلمة المرور */}
              {(modalMode === 'create' || modalMode === 'password') && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      {modalMode === 'create' ? 'كلمة المرور *' : 'كلمة المرور الجديدة *'}
                    </label>
                    <div className="input-wrapper">
                      <input
                        className="form-control-custom"
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }}
                        style={{ paddingLeft: '2.5rem' }}
                        id="input-password"
                        dir="ltr"
                      />
                      <button type="button" className="password-toggle" onClick={() => setShowPass(s => !s)}>
                        {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">تأكيد كلمة المرور *</label>
                    <input
                      className="form-control-custom"
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.confirmPassword}
                      onChange={e => { setForm(f => ({ ...f, confirmPassword: e.target.value })); setError(''); }}
                      id="input-confirm-password"
                      dir="ltr"
                    />
                  </div>
                </>
              )}

              {/* أزرار */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn-secondary" onClick={closeModal} disabled={saving}>
                  <FiX size={14} /> إلغاء
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={saving} id="btn-save-user">
                  {saving ? <span className="btn-login-spinner" /> : <FiCheck size={14} />}
                  {saving ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
