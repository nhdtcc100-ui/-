import { useState, useContext, createContext, useCallback, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { storeService } from '../services/storeService';
import type { DbUser } from '../services/dbService';

// ─────────────────────────────────────────────────────────────────
// Context Type
// ─────────────────────────────────────────────────────────────────

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: DbUser | null;
  isSupabase: boolean;
  isElectron: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (userData: {
    username: string;
    password: string;
    displayName?: string;
    role?: 'admin' | 'staff' | 'cashier';
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  isSupabase: false,
  isElectron: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
  changePassword: async () => ({ success: false, message: '' }),
});

export const useAuth = () => useContext(AuthContext);

// ─────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<DbUser | null>(() => {
    try {
      const stored = localStorage.getItem('wms_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('wms_auth') === 'true' && !!localStorage.getItem('wms_auth_user');
  });

  const isSupabase = isSupabaseConfigured();

  // فحص الجلسة من Supabase عند الإقلاع
  useEffect(() => {
    if (isSupabase) {
      supabaseService.initAuth().then(profile => {
        if (profile) {
          const userObj: DbUser = {
            id: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            role: profile.role,
            pinCode: profile.pinCode || '123456',
            isActive: true,
            createdAt: profile.createdAt,
          };
          setCurrentUser(userObj);
          setIsAuthenticated(true);
          localStorage.setItem('wms_auth', 'true');
          localStorage.setItem('wms_auth_user', JSON.stringify(userObj));
          // تحميل بيانات المستخدم من سوبابيس
          storeService.initFromCloud().catch(console.error);
        }
      }).catch(console.error);
    }
  }, [isSupabase]);

  // ── تسجيل الدخول ──────────────────────────────────────────────
  const login = useCallback(async (
    username: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {

    // 1. إذا كان Supabase مهيأ — تسجيل الدخول السحابي الموحد
    if (isSupabase) {
      const res = await supabaseService.login(username, password);
      if (res.success && res.user) {
        const userObj: DbUser = {
          id: res.user.id,
          username: res.user.username,
          displayName: res.user.displayName,
          role: res.user.role,
          pinCode: res.user.pinCode || '123456',
          isActive: true,
          createdAt: res.user.createdAt,
        };
        setCurrentUser(userObj);
        setIsAuthenticated(true);
        localStorage.setItem('wms_auth', 'true');
        localStorage.setItem('wms_auth_user', JSON.stringify(userObj));

        // جلب منتجات ومبيعات هذا المستخدم فوراً
        await storeService.initFromCloud();
        return { success: true };
      }
      return { success: false, message: res.message || 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    // 2. وضع محلي احتياطي عند عدم ربط Supabase بعد
    await new Promise(res => setTimeout(res, 200));
    try {
      const rawUsers = localStorage.getItem('wms_local_users');
      const usersList: Array<DbUser & { password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];
      const found = usersList.find(
        u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
      );

      if (found) {
        const userObj: DbUser = {
          id: found.id,
          username: found.username,
          displayName: found.displayName || found.username,
          role: found.role || 'admin',
          isActive: true,
          createdAt: found.createdAt || new Date().toISOString(),
        };
        setCurrentUser(userObj);
        setIsAuthenticated(true);
        localStorage.setItem('wms_auth', 'true');
        localStorage.setItem('wms_auth_user', JSON.stringify(userObj));
        return { success: true };
      }
    } catch {
      // ignore
    }

    // حساب المدير الافتراضي
    if (storeService.verifyCredentials(username, password)) {
      const adminUser: DbUser = {
        id: 'admin_local',
        username: username.trim(),
        displayName: 'مدير النظام',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setCurrentUser(adminUser);
      setIsAuthenticated(true);
      localStorage.setItem('wms_auth', 'true');
      localStorage.setItem('wms_auth_user', JSON.stringify(adminUser));
      return { success: true };
    }

    return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' };
  }, [isSupabase]);

  // ── إنشاء حساب جديد وتسجيل الدخول به فوراً ─────────────────────
  const register = useCallback(async (
    userData: {
      username: string;
      password: string;
      displayName?: string;
      role?: 'admin' | 'staff' | 'cashier';
    }
  ): Promise<{ success: boolean; message?: string }> => {
    if (isSupabase) {
      const res = await supabaseService.register(userData);
      if (res.success && res.user) {
        const userObj: DbUser = {
          id: res.user.id,
          username: res.user.username,
          displayName: res.user.displayName,
          role: res.user.role,
          pinCode: res.user.pinCode || '123456',
          isActive: true,
          createdAt: res.user.createdAt,
        };
        setCurrentUser(userObj);
        setIsAuthenticated(true);
        localStorage.setItem('wms_auth', 'true');
        localStorage.setItem('wms_auth_user', JSON.stringify(userObj));

        // تحميل / تهيئة بيانات المستخدم الجديد
        await storeService.initFromCloud();
        return { success: true };
      }
      return { success: false, message: res.message || 'تعذر إنشاء الحساب' };
    }

    // وضع الحسابات المحلية
    try {
      const rawUsers = localStorage.getItem('wms_local_users');
      const usersList: Array<DbUser & { password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];
      const cleanUser = userData.username.trim();

      if (
        cleanUser.toLowerCase() === 'admin' ||
        usersList.some(u => u.username.toLowerCase() === cleanUser.toLowerCase())
      ) {
        return { success: false, message: 'اسم المستخدم هذا مسجل مسبقاً، يرجى اختيار اسم آخر' };
      }

      const newUser: DbUser = {
        id: 'usr_' + Date.now(),
        username: cleanUser,
        displayName: (userData.displayName || cleanUser).trim(),
        role: userData.role || 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      usersList.push({ ...newUser, password: userData.password });
      localStorage.setItem('wms_local_users', JSON.stringify(usersList));

      setCurrentUser(newUser);
      setIsAuthenticated(true);
      localStorage.setItem('wms_auth', 'true');
      localStorage.setItem('wms_auth_user', JSON.stringify(newUser));
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل حفظ الحساب' };
    }
  }, [isSupabase]);

  // ── تسجيل الخروج ──────────────────────────────────────────────
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('wms_auth');
    localStorage.removeItem('wms_auth_user');

    if (isSupabase) {
      supabaseService.logout().catch(console.error);
    }
    storeService.clearUserData();
  }, [isSupabase]);

  // ── تغيير كلمة المرور ─────────────────────────────────────────
  const changePassword = useCallback(async (
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    if (isSupabase) {
      const res = await supabaseService.changePassword(newPassword);
      return { success: res.success, message: res.message || 'تم التغيير' };
    }

    // وضع الويب
    try {
      const rawUsers = localStorage.getItem('wms_local_users');
      const usersList: Array<DbUser & { password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];
      const userIdx = usersList.findIndex(u => u.username.toLowerCase() === currentUser?.username.toLowerCase());
      if (userIdx !== -1) {
        if (usersList[userIdx].password !== oldPassword) {
          return { success: false, message: 'كلمة المرور الحالية غير صحيحة' };
        }
        usersList[userIdx].password = newPassword;
        localStorage.setItem('wms_local_users', JSON.stringify(usersList));
        return { success: true, message: 'تم تغيير كلمة المرور بنجاح' };
      }
    } catch {}

    const res = storeService.changePassword(oldPassword, newPassword);
    return res;
  }, [isSupabase, currentUser]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      currentUser,
      isSupabase,
      isElectron: isSupabase,
      login,
      register,
      logout,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
