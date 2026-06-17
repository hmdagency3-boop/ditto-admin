import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LangProvider, useLang } from "@/contexts/LangContext";
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

function ProtectedRoute({ component: Component, superAdminOnly = false }: { component: React.ComponentType; superAdminOnly?: boolean }) {
  const { user, loading, isSuperAdmin } = useAuth();

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
  if (superAdminOnly && !isSuperAdmin) return <Redirect to="/" />;

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
      <div className="flex min-h-screen w-full" dir={dir}>
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
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
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/search">
        <ProtectedRoute component={SearchPage} />
      </Route>
      <Route path="/admins">
        <ProtectedRoute component={Admins} superAdminOnly />
      </Route>
      <Route path="/attendance">
        <ProtectedRoute component={Attendance} superAdminOnly />
      </Route>
      <Route path="/shifts">
        <ProtectedRoute component={Shifts} />
      </Route>
      <Route path="/ratings">
        <ProtectedRoute component={Ratings} superAdminOnly />
      </Route>
      <Route path="/warnings">
        <ProtectedRoute component={Warnings} superAdminOnly />
      </Route>
      <Route path="/pending-requests">
        <ProtectedRoute component={PendingRequests} superAdminOnly />
      </Route>
      <Route path="/my-attendance">
        <ProtectedRoute component={MyAttendance} />
      </Route>
      <Route path="/my-shifts">
        <ProtectedRoute component={MyShifts} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
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
            <TooltipProvider>
              <AppLayout>
                <Router />
              </AppLayout>
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </LangProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
