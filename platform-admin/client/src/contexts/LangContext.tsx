import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

const translations: Record<Lang, Record<string, string>> = {
  ar: {
    // App
    'app.name': 'نظام المشرفين',
    'app.role.super': 'المدير الرئيسي',
    'app.role.admin': 'مشرف',
    // Sidebar
    'nav.dashboard': 'لوحة التحكم',
    'nav.search': 'البحث عن مستخدم',
    'nav.admins': 'المشرفون',
    'nav.pending': 'طلبات التسجيل',
    'nav.attendance': 'سجل الحضور',
    'nav.shifts': 'جدول الشيفتات',
    'nav.ratings': 'التقييمات',
    'nav.warnings': 'الإنذارات',
    'nav.changeLogs': 'سجل التغييرات',
    'nav.tasks': 'المهام',
    'nav.myTasks': 'مهامي',
    'nav.events': 'الإيفنتات',
    'nav.myAttendance': 'حضوري',
    'nav.workManagement': 'إدارة العمل',
    'nav.agencies': 'الوكالات',
    'nav.supporters': 'الداعمين',
    'nav.myShifts': 'شيفتاتي',
    'nav.settings': 'الإعدادات',
    'nav.management': 'الإدارة',
    'nav.myAccount': 'حسابي',
    // Auth
    'auth.login': 'تسجيل الدخول',
    'auth.signup': 'حساب جديد',
    'auth.logout': 'تسجيل الخروج',
    'auth.username': 'اسم المستخدم',
    'auth.password': 'كلمة المرور',
    'auth.loginBtn': 'دخول',
    'auth.signupBtn': 'إنشاء حساب',
    'auth.title': 'نظام إدارة المشرفين',
    'auth.subtitle': 'نظام شامل لإدارة الحضور والتقييمات',
    'auth.adminHint': 'للدخول كمسؤول: اسم المستخدم admin وكلمة المرور admin123',
    // Search
    'search.title': 'البحث عن مستخدم',
    'search.single': 'بحث فردي',
    'search.batch': 'بحث جماعي',
    'search.placeholder': 'أدخل رقم الـ erban',
    'search.batchPlaceholder': 'أدخل أرقام erban (رقم في كل سطر)',
    'search.btn': 'بحث',
    'search.batchBtn': 'بحث عن الكل',
    'search.clear': 'مسح',
    'search.loading': 'جاري البحث...',
    'search.noResult': 'لم يتم العثور على مستخدم',
    'search.empty': 'ابحث عن مستخدم بإدخال رقم الـ erban',
    'search.batchEmpty': 'أدخل أرقام erban للبحث عنها دفعة واحدة',
    'search.found': 'نتيجة',
    'search.results': 'نتائج',
    'search.progress': 'جاري المعالجة',
    'search.uid': 'معرّف المستخدم',
    'search.erban': 'رقم Erban',
    'search.name': 'الاسم',
    'search.country': 'الدولة',
    'search.gender': 'الجنس',
    'search.male': 'ذكر',
    'search.female': 'أنثى',
    'search.online': '🟢 متصل',
    'search.safe': '✅ سليم',
    'search.gifts': 'هدايا الدردشة',
    'search.chatRange': 'نطاق الدردشة',
    'search.enabled': 'مفعّل',
    'search.disabled': 'معطّل',
    'search.public': 'عام',
    'search.private': 'خاص',
    'search.noble': 'نبيل',
    'search.platformInfo': 'معلومات المنصة',
    'search.basicInfo': 'المعلومات الأساسية',
    'search.status': 'الحالة',
    'search.ban': 'الحظر',
    'search.viewGrid': 'شبكة',
    'search.viewTable': 'جدول',
    // Settings
    'settings.title': 'الإعدادات',
    'settings.language': 'اللغة',
    'settings.theme': 'المظهر',
    'settings.arabic': 'العربية',
    'settings.english': 'English',
    'settings.dark': 'داكن',
    'settings.light': 'فاتح',
    'settings.system': 'تلقائي',
    'settings.account': 'الحساب',
    'settings.username': 'اسم المستخدم',
    'settings.role': 'الدور',
    'settings.super_admin': 'مدير رئيسي',
    'settings.admin': 'مشرف',
    // Common
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.add': 'إضافة',
    'common.search': 'بحث',
    'common.filter': 'فلتر',
    'common.export': 'تصدير',
    'common.loading': 'جاري التحميل...',
    'common.noData': 'لا توجد بيانات',
    'common.error': 'حدث خطأ',
    'common.success': 'تم بنجاح',
    'common.confirm': 'تأكيد',
    'common.all': 'الكل',
    'common.today': 'اليوم',
    'common.week': 'هذا الأسبوع',
    'common.month': 'هذا الشهر',
  },
  en: {
    // App
    'app.name': 'Admin System',
    'app.role.super': 'Super Admin',
    'app.role.admin': 'Moderator',
    // Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.search': 'User Search',
    'nav.admins': 'Admins',
    'nav.pending': 'Pending Requests',
    'nav.attendance': 'Attendance Log',
    'nav.shifts': 'Shift Schedule',
    'nav.ratings': 'Ratings',
    'nav.warnings': 'Warnings',
    'nav.changeLogs': 'Change Logs',
    'nav.tasks': 'Tasks',
    'nav.myTasks': 'My Tasks',
    'nav.events': 'Events',
    'nav.myAttendance': 'My Attendance',
    'nav.workManagement': 'Work Management',
    'nav.agencies': 'Agencies',
    'nav.supporters': 'Supporters',
    'nav.myShifts': 'My Shifts',
    'nav.settings': 'Settings',
    'nav.management': 'Management',
    'nav.myAccount': 'My Account',
    // Auth
    'auth.login': 'Login',
    'auth.signup': 'New Account',
    'auth.logout': 'Logout',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.loginBtn': 'Sign In',
    'auth.signupBtn': 'Register',
    'auth.title': 'Admin Management System',
    'auth.subtitle': 'Comprehensive attendance and ratings management',
    'auth.adminHint': 'Admin login: username admin, password admin123',
    // Search
    'search.title': 'User Search',
    'search.single': 'Single Search',
    'search.batch': 'Batch Search',
    'search.placeholder': 'Enter erban number',
    'search.batchPlaceholder': 'Enter erban numbers (one per line)',
    'search.btn': 'Search',
    'search.batchBtn': 'Search All',
    'search.clear': 'Clear',
    'search.loading': 'Searching...',
    'search.noResult': 'User not found',
    'search.empty': 'Search for a user by entering their erban number',
    'search.batchEmpty': 'Enter erban numbers to batch search',
    'search.found': 'result',
    'search.results': 'results',
    'search.progress': 'Processing',
    'search.uid': 'User ID',
    'search.erban': 'Erban Number',
    'search.name': 'Name',
    'search.country': 'Country',
    'search.gender': 'Gender',
    'search.male': 'Male',
    'search.female': 'Female',
    'search.online': '🟢 Online',
    'search.safe': '✅ Safe',
    'search.gifts': 'Chat Gifts',
    'search.chatRange': 'Chat Range',
    'search.enabled': 'Enabled',
    'search.disabled': 'Disabled',
    'search.public': 'Public',
    'search.private': 'Private',
    'search.noble': 'Noble',
    'search.platformInfo': 'Platform Info',
    'search.basicInfo': 'Basic Info',
    'search.status': 'Status',
    'search.ban': 'Ban Status',
    'search.viewGrid': 'Grid',
    'search.viewTable': 'Table',
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.arabic': 'العربية',
    'settings.english': 'English',
    'settings.dark': 'Dark',
    'settings.light': 'Light',
    'settings.system': 'System',
    'settings.account': 'Account',
    'settings.username': 'Username',
    'settings.role': 'Role',
    'settings.super_admin': 'Super Admin',
    'settings.admin': 'Admin',
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.loading': 'Loading...',
    'common.noData': 'No data',
    'common.error': 'An error occurred',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.all': 'All',
    'common.today': 'Today',
    'common.week': 'This Week',
    'common.month': 'This Month',
  },
};

const LangContext = createContext<LangContextType | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('lang') as Lang) || 'ar';
  });

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
  }

  function t(key: string): string {
    return translations[lang][key] || translations['ar'][key] || key;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
