import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LangProvider, useLang } from "@/contexts/LangContext";
import { DittoSessionProvider } from "@/contexts/DittoSessionContext";
import { DittoSessionBar } from "@/components/DittoSessionBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Admins from "@/pages/Admins";
import Attendance from "@/pages/Attendance";
import Shifts from "@/pages/Shifts";
import Ratings from "@/pages/Ratings";
import Warnings from "@/pages/Warnings";
import MyAttendance from "@/pages/MyAttendance";
import MyShifts from "@/pages/MyShifts";
import PendingRequests from "@/pages/PendingRequests";
import PendingApproval from "@/pages/PendingApproval";
import SearchPage from "@/pages/Search";
import Settings from "@/pages/Settings";
import ChangeLogs from "@/pages/ChangeLogs";
import AdminProfile from "@/pages/AdminProfile";
import Tasks from "@/pages/Tasks";
import MyTasks from "@/pages/MyTasks";
import Events from "@/pages/Events";
import WorkManagement from "@/pages/WorkManagement";
import AgenciesPage from "@/pages/AgenciesPage";
import SupportersPage from "@/pages/SupportersPage";
import DittoCommandCenter from "@/pages/DittoCommandCenter";
import DittoRooms from "@/pages/DittoRooms";
import DittoProfileSearch from "@/pages/DittoProfileSearch";
import Recordings from "@/pages/Recordings";
import Absences from "@/pages/Absences";
import SalaryComplaints from "@/pages/SalaryComplaints";
import SystemDownComplaints from "@/pages/SystemDownComplaints";
import WhatsApp from "@/pages/WhatsApp";

function ProtectedRoute({
  component: Component,
  superAdminOnly = false,
  permission,
}: {
  component: React.ComponentType;
  superAdminOnly?: boolean;
  permission?: string;
}) {
  const { user, loading, isSuperAdmin, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (user.role === 'assistant' && permission && !hasPermission(permission)) return <Redirect to="/" />;
  if (superAdminOnly && !isSuperAdmin && user.role !== 'assistant') return <Redirect to="/" />;
  if (superAdminOnly && user.role === 'assistant' && !permission) return <Redirect to="/" />;

  return <Component />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { dir } = useLang();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return <>{children}</>;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div
        className="flex min-h-screen w-full"
        dir={dir}
        onDragStart={(event) => {
          const target = event.target as HTMLElement;
          // Keep normal text selection/copying responsive instead of letting
          // the browser start a full-page drag operation.
          if (!target.closest('input, textarea, [contenteditable="true"], [data-allow-drag]')) {
            event.preventDefault();
          }
        }}
      >
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-h-0">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-2 p-3 border-b bg-background">
            <SidebarTrigger />
            <ThemeToggle />
          </header>
          <DittoSessionBar />
          <main className="flex-1 overflow-auto overflow-x-hidden">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/pending-approval" component={PendingApproval} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} permission="dashboard.view" />
      </Route>
      <Route path="/search">
        <ProtectedRoute component={SearchPage} superAdminOnly permission="search.view" />
      </Route>
      <Route path="/admins">
        <ProtectedRoute component={Admins} superAdminOnly permission="admins.manage" />
      </Route>
      <Route path="/attendance">
        <ProtectedRoute component={Attendance} superAdminOnly permission="attendance.view" />
      </Route>
      <Route path="/shifts">
        <ProtectedRoute component={Shifts} permission="shifts.view" />
      </Route>
      <Route path="/ratings">
        <ProtectedRoute component={Ratings} superAdminOnly permission="ratings.view" />
      </Route>
      <Route path="/warnings">
        <ProtectedRoute component={Warnings} superAdminOnly permission="warnings.view" />
      </Route>
      <Route path="/pending-requests">
        <ProtectedRoute component={PendingRequests} superAdminOnly permission="pendingRequests.manage" />
      </Route>
      <Route path="/my-attendance">
        <ProtectedRoute component={MyAttendance} permission="attendance.view" />
      </Route>
      <Route path="/my-shifts">
        <ProtectedRoute component={MyShifts} permission="shifts.view" />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} permission="settings.view" />
      </Route>
      <Route path="/change-logs">
        <ProtectedRoute component={ChangeLogs} superAdminOnly permission="changeLogs.view" />
      </Route>
      <Route path="/tasks">
        <ProtectedRoute component={Tasks} superAdminOnly permission="tasks.view" />
      </Route>
      <Route path="/my-tasks">
        <ProtectedRoute component={MyTasks} permission="tasks.view" />
      </Route>
      <Route path="/events">
        <ProtectedRoute component={Events} superAdminOnly permission="events.view" />
      </Route>
      <Route path="/work-management">
        <ProtectedRoute component={WorkManagement} superAdminOnly permission="workManagement.view" />
      </Route>
      <Route path="/agencies">
        <ProtectedRoute component={AgenciesPage} superAdminOnly permission="agencies.manage" />
      </Route>
      <Route path="/supporters">
        <ProtectedRoute component={SupportersPage} superAdminOnly permission="supporters.manage" />
      </Route>
      <Route path="/admins/:id">
        <ProtectedRoute component={AdminProfile} superAdminOnly />
      </Route>
      <Route path="/ditto-center">
        <ProtectedRoute component={DittoCommandCenter} superAdminOnly permission="dittoCenter.view" />
      </Route>
      <Route path="/ditto-rooms">
        <ProtectedRoute component={DittoRooms} superAdminOnly permission="dittoRooms.view" />
      </Route>
      <Route path="/ditto-search">
        <ProtectedRoute component={DittoProfileSearch} superAdminOnly permission="dittoSearch.view" />
      </Route>
      <Route path="/recordings">
        <ProtectedRoute component={Recordings} superAdminOnly permission="recordings.view" />
      </Route>
      <Route path="/absences">
        <ProtectedRoute component={Absences} superAdminOnly permission="absences.view" />
      </Route>
      <Route path="/salary-complaints">
        <ProtectedRoute component={SalaryComplaints} superAdminOnly permission="salaryComplaints.manage" />
      </Route>
      <Route path="/system-down-complaints">
        <ProtectedRoute component={SystemDownComplaints} superAdminOnly permission="systemDownComplaints.manage" />
      </Route>
      <Route path="/whatsapp">
        <ProtectedRoute component={WhatsApp} superAdminOnly permission="whatsapp.manage" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LangProvider>
          <AuthProvider>
            <DittoSessionProvider>
              <TooltipProvider>
                <AppLayout>
                  <Router />
                </AppLayout>
                <Toaster />
              </TooltipProvider>
            </DittoSessionProvider>
          </AuthProvider>
        </LangProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
