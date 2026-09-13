export type PermissionKey =
  | 'dashboard.view'
  | 'search.view'
  | 'admins.manage'
  | 'attendance.view'
  | 'attendance.manage'
  | 'shifts.view'
  | 'shifts.manage'
  | 'ratings.view'
  | 'ratings.manage'
  | 'warnings.view'
  | 'warnings.manage'
  | 'pendingRequests.manage'
  | 'tasks.view'
  | 'tasks.manage'
  | 'events.view'
  | 'events.manage'
  | 'workManagement.view'
  | 'workManagement.manage'
  | 'agencies.manage'
  | 'supporters.manage'
  | 'fixedSalary.manage'
  | 'dittoCenter.view'
  | 'dittoRooms.view'
  | 'dittoSearch.view'
  | 'whatsapp.manage'
  | 'settings.view'
  | 'changeLogs.view'
  | 'changeLogs.manage'
  | 'recordings.view'
  | 'recordings.manage'
  | 'absences.view'
  | 'absences.manage'
  | 'salaryComplaints.manage'
  | 'systemDownComplaints.manage';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'dashboard.view', label: 'لوحة التحكم', description: 'عرض لوحة الإحصائيات والمتابعة', group: 'الصفحات الأساسية' },
  { key: 'search.view', label: 'البحث', description: 'البحث في بيانات المشرفين', group: 'الصفحات الأساسية' },
  { key: 'admins.manage', label: 'إدارة المشرفين', description: 'عرض وتعديل وحذف وإدارة المشرفين', group: 'إدارة المشرفين' },
  { key: 'attendance.view', label: 'الحضور', description: 'عرض بيانات الحضور', group: 'إدارة المشرفين' },
  { key: 'attendance.manage', label: 'إدارة الحضور', description: 'تسجيل وتعديل بيانات الحضور', group: 'إدارة المشرفين' },
  { key: 'shifts.view', label: 'الشيفتات', description: 'عرض الشيفتات والزملاء', group: 'إدارة المشرفين' },
  { key: 'shifts.manage', label: 'إدارة الشيفتات', description: 'إضافة وحذف المشرفين من الشيفتات', group: 'إدارة المشرفين' },
  { key: 'ratings.view', label: 'التقييمات', description: 'عرض التقييمات', group: 'التشغيل' },
  { key: 'ratings.manage', label: 'إدارة التقييمات', description: 'إضافة وحذف التقييمات', group: 'التشغيل' },
  { key: 'warnings.view', label: 'الإنذارات', description: 'عرض الإنذارات', group: 'التشغيل' },
  { key: 'warnings.manage', label: 'إدارة الإنذارات', description: 'إضافة وحذف الإنذارات', group: 'التشغيل' },
  { key: 'pendingRequests.manage', label: 'طلبات التسجيل', description: 'مراجعة وقبول ورفض الطلبات', group: 'التشغيل' },
  { key: 'tasks.view', label: 'المهام', description: 'عرض المهام', group: 'التشغيل' },
  { key: 'tasks.manage', label: 'إدارة المهام', description: 'إنشاء وتعديل وحذف المهام', group: 'التشغيل' },
  { key: 'events.view', label: 'الإعلانات', description: 'عرض الإعلانات والأحداث', group: 'التشغيل' },
  { key: 'events.manage', label: 'إدارة الإعلانات', description: 'إنشاء وتعديل وحذف الإعلانات', group: 'التشغيل' },
  { key: 'workManagement.view', label: 'إدارة العمل', description: 'عرض إدارة العمل', group: 'التشغيل' },
  { key: 'workManagement.manage', label: 'إدارة العمل المتقدمة', description: 'تعديل وإدارة بيانات العمل', group: 'التشغيل' },
  { key: 'agencies.manage', label: 'الوكالات', description: 'إدارة الوكالات', group: 'التشغيل' },
  { key: 'supporters.manage', label: 'الداعمين', description: 'إدارة الداعمين', group: 'التشغيل' },
  { key: 'fixedSalary.manage', label: 'الرواتب الثابتة', description: 'إدارة مجموعات وتقارير الرواتب الثابتة', group: 'التشغيل' },
  { key: 'dittoCenter.view', label: 'مركز Ditto', description: 'عرض مركز التحكم', group: 'أدوات Ditto' },
  { key: 'dittoRooms.view', label: 'غرف Ditto', description: 'دخول غرف Ditto والاستماع', group: 'أدوات Ditto' },
  { key: 'dittoSearch.view', label: 'بحث Ditto', description: 'البحث في بيانات Ditto', group: 'أدوات Ditto' },
  { key: 'whatsapp.manage', label: 'WhatsApp', description: 'إدارة جلسة WhatsApp والردود الذكية', group: 'أدوات Ditto' },
  { key: 'settings.view', label: 'الإعدادات', description: 'عرض الإعدادات الشخصية', group: 'أدوات Ditto' },
  { key: 'changeLogs.view', label: 'سجل التغييرات', description: 'عرض سجل التغييرات', group: 'التقارير' },
  { key: 'changeLogs.manage', label: 'فحص التغييرات', description: 'تشغيل فحص تغييرات المنصة', group: 'التقارير' },
  { key: 'recordings.view', label: 'التسجيلات', description: 'عرض وإدارة تسجيلات الغرف', group: 'التقارير' },
  { key: 'recordings.manage', label: 'إدارة التسجيلات', description: 'رفع وحذف التسجيلات', group: 'التقارير' },
  { key: 'absences.view', label: 'الغياب', description: 'عرض تقارير الغياب', group: 'التقارير' },
  { key: 'absences.manage', label: 'إدارة الغياب', description: 'تسجيل وتعديل وحذف مخالفات الغياب', group: 'التقارير' },
  { key: 'salaryComplaints.manage', label: 'شكاوى الراتب', description: 'عرض وإدارة شكاوى الراتب', group: 'التقارير' },
  { key: 'systemDownComplaints.manage', label: 'شكاوى تعطل النظام', description: 'عرض وإدارة شكاوى تعطل النظام', group: 'التقارير' },
];

export const ASSISTANT_DEFAULT_PERMISSIONS: PermissionKey[] = [
  'dashboard.view',
  'tasks.view',
  'settings.view',
];

export function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((permission): permission is string => typeof permission === 'string');
}

export function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  if (!permissions) return false;
  if (permissions.includes(permission)) return true;
  return permission.endsWith('.view') && permissions.includes(permission.replace(/\.view$/, '.manage'));
}
