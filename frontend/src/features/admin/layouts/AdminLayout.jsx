import { useState, useEffect, useCallback } from 'react';
import { Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../constants/roles';
import { ROLE_TO_DIVISION, DIVISION_LABELS } from '../constants/divisions';
import styles from './AdminLayout.module.css';

/**
 * Egyptian Space Agency Academy — Institutional Admin Layout Shell
 * Establishes:
 * - Authoritative Aerospace Command Sidebar on desktop (sticky 100vh)
 * - Mobile & Tablet Off-Canvas Drawer with accessible backdrop and dismiss controls
 * - Compact Operational Header with breadcrumbs and division switcher
 * - Fluid, responsive main workspace container with standardized padding
 * - Clean, full-width presentation for Administration Gateway & Platform Management
 */
export default function AdminLayout() {
  const { user } = useAuth();
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const userDivision = ROLE_TO_DIVISION[user?.role] || 'PRE_UNIVERSITY';

  // Check if current route is the top-level Gateway or Platform Administrator management
  const isGatewayPage = location.pathname === '/admin';
  const isAdminManagementPage = location.pathname === '/admin/administrators';

  // Mobile navigation drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop sidebar collapsed rail state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('esa_admin_sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('esa_admin_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Keyboard shortcut: Ctrl + B or Cmd + B to toggle sidebar rail
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleSidebarCollapse]);

  // Close mobile drawer on route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Selected division workspace for Super Admin
  const [selectedDivision, setSelectedDivision] = useState(() => {
    if (params.division && (params.division === 'PRE_UNIVERSITY' || params.division === 'UNIVERSITY')) {
      return params.division;
    }
    const saved = localStorage.getItem('esa_active_division');
    if (saved === 'UNIVERSITY' || saved === 'PRE_UNIVERSITY') {
      return saved;
    }
    return 'PRE_UNIVERSITY';
  });

  // Sync selectedDivision whenever URL division parameter changes
  useEffect(() => {
    if (params.division && (params.division === 'PRE_UNIVERSITY' || params.division === 'UNIVERSITY')) {
      setSelectedDivision(params.division);
      localStorage.setItem('esa_active_division', params.division);
    }
  }, [params.division]);

  // Return Super Admin to Administration Gateway
  const handleBackToGateway = () => {
    localStorage.removeItem('esa_active_division');
    navigate('/admin');
  };

  // Handle smooth division switching
  const handleSwitchDivision = (newDivision) => {
    setSelectedDivision(newDivision);
    localStorage.setItem('esa_active_division', newDivision);

    const currentPath = location.pathname;
    const match = currentPath.match(/^\/admin\/(PRE_UNIVERSITY|UNIVERSITY)(\/.*)?$/);
    if (match) {
      const subPath = match[2] || '';
      navigate(`/admin/${newDivision}${subPath}`);
    } else {
      navigate(`/admin/${newDivision}`);
    }
  };

  // Active workspace division to display in sidebar and scope queries
  const activeDivision = params.division || (isSuperAdmin ? selectedDivision : userDivision);

  // Operational navigation sections for Division Workspaces
  const divisionSections = [
    {
      title: 'Command & Oversight',
      collapsible: false,
      defaultOpen: true,
      icon: 'fa-gauge-high',
      items: [
        { to: `/admin/${activeDivision}`, icon: 'fa-chart-line', label: 'Division Dashboard', end: true },
      ],
    },
    {
      title: 'Academic Programs',
      collapsible: true,
      defaultOpen: true,
      icon: 'fa-graduation-cap',
      items: [
        { to: `/admin/${activeDivision}/programs`, icon: 'fa-book-open', label: 'Programs & Courses' },
        { to: `/admin/${activeDivision}/cohorts`, icon: 'fa-people-group', label: 'Cohorts & Delivery' },
        { to: `/admin/${activeDivision}/sessions`, icon: 'fa-tower-broadcast', label: 'Live Session Monitoring' },
        { to: `/admin/${activeDivision}/assessments`, icon: 'fa-clipboard-check', label: 'Assessments & Exams' },
      ],
    },
    {
      title: 'Admissions & Cadets',
      collapsible: true,
      defaultOpen: true,
      icon: 'fa-id-card',
      items: [
        { to: `/admin/${activeDivision}/applications`, icon: 'fa-file-lines', label: 'Student Applications' },
        { to: `/admin/${activeDivision}/students`, icon: 'fa-user-graduate', label: 'Students Directory' },
        { to: `/admin/${activeDivision}/instructors`, icon: 'fa-chalkboard-user', label: 'Faculty Instructors' },
      ],
    },
    {
      title: 'Finance & Quality',
      collapsible: true,
      defaultOpen: false,
      icon: 'fa-file-invoice-dollar',
      items: [
        { to: `/admin/${activeDivision}/payments`, icon: 'fa-receipt', label: 'Manual Payment Reviews' },
        { to: `/admin/${activeDivision}/certificates`, icon: 'fa-certificate', label: 'Issued Certificates' },
        { to: `/admin/${activeDivision}/feedback`, icon: 'fa-comment-dots', label: 'Student Feedback' },
      ],
    },
    {
      title: 'System & Security',
      collapsible: true,
      defaultOpen: false,
      icon: 'fa-shield-halved',
      items: [
        { to: `/admin/${activeDivision}/messages`, icon: 'fa-comments', label: 'Support & Messaging' },
        { to: `/admin/${activeDivision}/notifications`, icon: 'fa-bell', label: 'Broadcast Notifications' },
        { to: `/admin/${activeDivision}/reports`, icon: 'fa-chart-pie', label: 'Reports & Analytics' },
        { to: `/admin/${activeDivision}/audit-logs`, icon: 'fa-shield-halved', label: 'Security Audit Logs' },
      ],
    },
  ];

  // 1. GATEWAY & ADMIN MANAGEMENT: Minimal, clean full-width layout without operational division sidebar
  if (isGatewayPage || isAdminManagementPage) {
    return (
      <div className={styles.gatewayShell}>
        <Navbar
          onToggleMobileMenu={null}
          isMobileMenuOpen={false}
          isSidebarCollapsed={false}
          onToggleSidebarCollapse={null}
          workspaceSwitcher={{
            isGateway: true,
            isSuperAdmin,
          }}
        />
        <main className={styles.gatewayMain}>
          <div className={styles.gatewayContainer}>
            <Outlet context={{ isSuperAdmin }} />
          </div>
        </main>
      </div>
    );
  }

  // 2. DIVISION WORKSPACE: Full aerospace console layout with sticky sidebar and main column
  return (
    <div className={styles.adminShell}>
      {/* Institutional Admin Sidebar */}
      <Sidebar
        sections={divisionSections}
        activeDivision={activeDivision}
        label={`${DIVISION_LABELS[activeDivision] || activeDivision} WORKSPACE`}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        onBackToGateway={isSuperAdmin ? handleBackToGateway : null}
        isSuperAdmin={isSuperAdmin}
        user={user}
      />

      {/* Main Content Column */}
      <div className={styles.mainColumn}>
        <Navbar
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
          workspaceSwitcher={{
            activeDivision,
            onSelectDivision: handleSwitchDivision,
            onExitToGateway: handleBackToGateway,
            isSuperAdmin,
            isGateway: false,
          }}
        />

        <main className={styles.mainContent}>
          <div className="esa-container">
            <Outlet context={{ division: activeDivision, isSuperAdmin }} />
          </div>
        </main>
      </div>
    </div>
  );
}
