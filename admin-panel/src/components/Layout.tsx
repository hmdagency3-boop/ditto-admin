import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Users,
  Settings,
  LogOut,
} from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { path: '/agencies', label: 'الوكالات', icon: Building2 },
  { path: '/admins', label: 'المشرفون', icon: ShieldCheck },
  { path: '/users', label: 'المستخدمون', icon: Users },
]

export default function Layout() {
  const location = useLocation()

  const pageTitle = () => {
    const item = navItems.find(n => location.pathname.startsWith(n.path))
    return item?.label ?? 'النظام الإداري'
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>لوحة الإدارة</h1>
          <p>نظام إدارة المنصة</p>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">القائمة الرئيسية</div>
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon />
              {label}
            </NavLink>
          ))}

          <div className="nav-section-title" style={{ marginTop: 12 }}>الإعدادات</div>
          <a href="#" className="nav-item">
            <Settings />
            الإعدادات
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">م</div>
            <div className="user-info">
              <h4>المشرف العام</h4>
              <p>admin@platform.com</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{pageTitle()}</span>
          <div className="topbar-actions">
            <button className="btn btn-outline btn-sm">
              <LogOut />
              تسجيل الخروج
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
