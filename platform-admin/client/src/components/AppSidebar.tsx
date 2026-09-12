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
  Activity,
  LayoutGrid,
  UserSearch,
  Video,
  CalendarX,
  FileWarning,
  ArrowDownCircle,
  MessageCircle,
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

  const superAdminSections = [
    {
      key: 'nav.overview',
      items: [
        { key: 'nav.dashboard', url: '/', icon: LayoutDashboard },
        { key: 'nav.search', url: '/search', icon: Search },
        { key: 'nav.pending', url: '/pending-requests', icon: UserCheck },
      ],
    },
    {
      key: 'nav.adminManagement',
      items: [
        { key: 'nav.admins', url: '/admins', icon: Users },
        { key: 'nav.attendance', url: '/attendance', icon: Clock },
        { key: 'nav.shifts', url: '/shifts', icon: Calendar },
      ],
    },
    {
      key: 'nav.operations',
      items: [
        { key: 'nav.ratings', url: '/ratings', icon: Star },
        { key: 'nav.warnings', url: '/warnings', icon: AlertTriangle },
        { key: 'nav.tasks', url: '/tasks', icon: ClipboardList },
        { key: 'nav.events', url: '/events', icon: Megaphone },
        { key: 'nav.workManagement', url: '/work-management', icon: Briefcase },
        { key: 'nav.agencies', url: '/agencies', icon: Building2 },
        { key: 'nav.supporters', url: '/supporters', icon: HeartHandshake },
      ],
    },
    {
      key: 'nav.tools',
      items: [
        { key: 'nav.dittoCenter', url: '/ditto-center', icon: Activity },
        { key: 'nav.dittoRooms', url: '/ditto-rooms', icon: LayoutGrid },
        { key: 'nav.dittoSearch', url: '/ditto-search', icon: UserSearch },
        { key: 'nav.whatsapp', url: '/whatsapp', icon: MessageCircle },
        { key: 'nav.settings', url: '/settings', icon: Settings },
      ],
    },
    {
      key: 'nav.reports',
      items: [
        { key: 'nav.changeLogs', url: '/change-logs', icon: History },
        { key: 'nav.recordings', url: '/recordings', icon: Video },
        { key: 'nav.absences', url: '/absences', icon: CalendarX },
        { key: 'nav.salaryComplaints', url: '/salary-complaints', icon: FileWarning },
        { key: 'nav.systemDownComplaints', url: '/system-down-complaints', icon: ArrowDownCircle },
      ],
    },
  ];

  const adminSections = [
    {
      key: 'nav.myAccount',
      items: [
        { key: 'nav.dashboard', url: '/', icon: LayoutDashboard },
        { key: 'nav.myTasks', url: '/my-tasks', icon: ClipboardList },
        { key: 'nav.myAttendance', url: '/my-attendance', icon: Clock },
        { key: 'nav.myShifts', url: '/my-shifts', icon: Calendar },
        { key: 'nav.settings', url: '/settings', icon: Settings },
      ],
    },
  ];

  const menuSections = isSuperAdmin ? superAdminSections : adminSections;

  const getInitials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const ActiveArrow = isRtl ? ChevronLeft : ChevronRight;

  return (
    <Sidebar side={isRtl ? 'right' : 'left'} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-lg font-bold text-sidebar-primary-foreground shadow-sm group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:text-base">
            {isCollapsed ? 'A' : 'AD'}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-bold text-sidebar-foreground">{t('app.name')}</span>
              <span className="mt-0.5 truncate text-[11px] text-sidebar-foreground/55">
                {isSuperAdmin ? t('app.role.super') : t('app.role.admin')}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 group-data-[collapsible=icon]:px-1">
        {menuSections.map((section, sectionIndex) => (
          <SidebarGroup
            key={section.key}
            className={sectionIndex > 0
              ? 'pt-3 group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:border-sidebar-border/60 group-data-[collapsible=icon]:pt-2'
              : ''}
          >
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-sidebar-foreground/45">
              {t(section.key)}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:gap-1">
                {section.items.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={t(item.key)}
                        className="h-9 rounded-lg px-3 text-[13px] data-[active=true]:bg-sidebar-primary/10 data-[active=true]:font-bold data-[active=true]:text-sidebar-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-md"
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">{t(item.key)}</span>
                          {isActive && <ActiveArrow className="ms-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <Avatar className="h-9 w-9 shrink-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
            {user?.externalImage && <AvatarImage src={user.externalImage} />}
            <AvatarFallback className="bg-sidebar-primary/10 text-sm font-bold text-sidebar-primary">
              {user?.full_name ? getInitials(user.full_name) : 'A'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-sidebar-foreground">
                {user?.externalName || user?.full_name || t('nav.myAccount')}
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/55">@{user?.username}</p>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 shrink-0 rounded-lg text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8" title={t('auth.logout')}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
