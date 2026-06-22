import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Star,
  AlertTriangle,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Search,
  Settings,
  History,
  ClipboardList,
  Megaphone,
  Briefcase,
  Building2,
  HeartHandshake,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';

export function AppSidebar() {
  const [location] = useLocation();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { t, lang } = useLang();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const isRtl = lang === 'ar';

  const superAdminItems = [
    { key: 'nav.dashboard', url: '/', icon: LayoutDashboard },
    { key: 'nav.search', url: '/search', icon: Search },
    { key: 'nav.pending', url: '/pending-requests', icon: UserCheck },
    { key: 'nav.admins', url: '/admins', icon: Users },
    { key: 'nav.attendance', url: '/attendance', icon: Clock },
    { key: 'nav.shifts', url: '/shifts', icon: Calendar },
    { key: 'nav.ratings', url: '/ratings', icon: Star },
    { key: 'nav.warnings', url: '/warnings', icon: AlertTriangle },
    { key: 'nav.tasks', url: '/tasks', icon: ClipboardList },
    { key: 'nav.events', url: '/events', icon: Megaphone },
    { key: 'nav.workManagement', url: '/work-management', icon: Briefcase },
    { key: 'nav.agencies', url: '/agencies', icon: Building2 },
    { key: 'nav.supporters', url: '/supporters', icon: HeartHandshake },
    { key: 'nav.changeLogs', url: '/change-logs', icon: History },
    { key: 'nav.settings', url: '/settings', icon: Settings },
  ];

  const adminItems = [
    { key: 'nav.dashboard', url: '/', icon: LayoutDashboard },
    { key: 'nav.myTasks', url: '/my-tasks', icon: ClipboardList },
    { key: 'nav.myAttendance', url: '/my-attendance', icon: Clock },
    { key: 'nav.myShifts', url: '/my-shifts', icon: Calendar },
    { key: 'nav.settings', url: '/settings', icon: Settings },
  ];

  const menuItems = isSuperAdmin ? superAdminItems : adminItems;

  const getInitials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const ActiveArrow = isRtl ? ChevronLeft : ChevronRight;

  return (
    <Sidebar side={isRtl ? 'right' : 'left'} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground font-bold text-lg shrink-0">
            {isCollapsed ? 'A' : 'AD'}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sidebar-foreground truncate">{t('app.name')}</span>
              <span className="text-xs text-muted-foreground">
                {isSuperAdmin ? t('app.role.super') : t('app.role.admin')}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isSuperAdmin ? t('nav.management') : t('nav.myAccount')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.key)}>
                      <Link href={item.url}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{t(item.key)}</span>
                        {isActive && <ActiveArrow className="ms-auto h-4 w-4" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            {user?.externalImage && <AvatarImage src={user.externalImage} />}
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {user?.full_name ? getInitials(user.full_name) : 'A'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">
                {user?.externalName || user?.full_name || t('nav.myAccount')}
              </p>
              <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} className="shrink-0" title={t('auth.logout')}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
