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
  UserCheck
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

const superAdminMenuItems = [
  { title: 'لوحة التحكم', url: '/', icon: LayoutDashboard },
  { title: 'طلبات التسجيل', url: '/pending-requests', icon: UserCheck },
  { title: 'المشرفون', url: '/admins', icon: Users },
  { title: 'سجل الحضور', url: '/attendance', icon: Clock },
  { title: 'جدول الشيفتات', url: '/shifts', icon: Calendar },
  { title: 'التقييمات', url: '/ratings', icon: Star },
  { title: 'الإنذارات', url: '/warnings', icon: AlertTriangle },
];

const adminMenuItems = [
  { title: 'لوحة التحكم', url: '/', icon: LayoutDashboard },
  { title: 'حضوري', url: '/my-attendance', icon: Clock },
  { title: 'شيفتاتي', url: '/my-shifts', icon: Calendar },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const menuItems = isSuperAdmin ? superAdminMenuItems : adminMenuItems;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground font-bold text-lg">
            {isCollapsed ? 'م' : 'مش'}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">نظام المشرفين</span>
              <span className="text-xs text-muted-foreground">
                {isSuperAdmin ? 'المدير الرئيسي' : 'مشرف'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{isSuperAdmin ? 'الإدارة' : 'حسابي'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url} data-testid={`link-${item.url.replace('/', '') || 'dashboard'}`}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                        {isActive && <ChevronLeft className="mr-auto h-4 w-4" />}
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
          <Avatar className="h-9 w-9">
            {user?.externalImage && (
              <AvatarImage src={user.externalImage} alt="User avatar" />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {user?.full_name ? getInitials(user.full_name) : 'م'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">
                {user?.externalName || user?.full_name || 'مستخدم'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{user?.username || ''}
              </p>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={signOut}
            className="shrink-0"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
