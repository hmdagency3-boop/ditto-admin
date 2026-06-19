import { Globe, Moon, Sun, User, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLang, type Lang } from '@/contexts/LangContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { lang, setLang, t } = useLang();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const languages: { value: Lang; label: string; flag: string }[] = [
    { value: 'ar', label: t('settings.arabic'), flag: '🇸🇦' },
    { value: 'en', label: t('settings.english'), flag: '🇺🇸' },
  ];

  const themes = [
    { value: 'light' as const, label: t('settings.light'), icon: Sun },
    { value: 'dark' as const, label: t('settings.dark'), icon: Moon },
  ];

  return (
    <div className="page-wrapper max-w-2xl mx-auto">
      <div>
        <h1 className="page-title">{t('settings.title')}</h1>
      </div>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('settings.language')}
          </CardTitle>
          <CardDescription>
            {lang === 'ar' ? 'اختر لغة الواجهة' : 'Choose interface language'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {languages.map(({ value, label, flag }) => (
              <button
                key={value}
                onClick={() => setLang(value)}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all text-start ${
                  lang === value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <span className="text-2xl">{flag}</span>
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{value === 'ar' ? 'RTL' : 'LTR'}</p>
                </div>
                {lang === value && (
                  <span className="mr-auto text-primary text-lg">✓</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {t('settings.theme')}
          </CardTitle>
          <CardDescription>
            {lang === 'ar' ? 'اختر مظهر التطبيق' : 'Choose app appearance'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                  theme === value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{label}</span>
                {theme === value && <span className="text-primary text-xs">✓</span>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('settings.account')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">{t('settings.username')}</span>
            <span className="font-mono font-medium">@{user?.username}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">{t('settings.role')}</span>
            <Badge variant={user?.role === 'super_admin' ? 'destructive' : 'secondary'}>
              <Shield className="h-3 w-3 mr-1" />
              {user?.role === 'super_admin' ? t('settings.super_admin') : t('settings.admin')}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{t('settings.username')}</span>
            <span className="text-sm">{user?.full_name}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
