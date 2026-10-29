import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from './NotificationBell';
import styles from './Navbar.module.css';

const DIVISION_OPTIONS = [
  {
    key: 'PRE_UNIVERSITY',
    name: 'Pre-University Administration',
    shortName: 'Pre-University',
    icon: 'fa-school',
    desc: 'K-12 students & youth space tracks',
  },
  {
    key: 'UNIVERSITY',
    name: 'University Administration',
    shortName: 'University',
    icon: 'fa-graduation-cap',
    desc: 'Undergraduate & space engineering tracks',
  },
];

const ROUTE_TITLES = {
  programs: 'Programs & Courses',
  cohorts: 'Cohorts & Delivery',
  sessions: 'Live Session Monitoring',
  assessments: 'Assessments & Exams',
  applications: 'Student Applications',
  students: 'Students Directory',
  instructors: 'Faculty Instructors',
  payments: 'Manual Payment Reviews',
  certificates: 'Issued Certificates',
  feedback: 'Student Feedback',
  messages: 'Support & Messaging',
  notifications: 'Broadcast Notifications',
  reports: 'Reports & Analytics',
  'audit-logs': 'Security Audit Logs',
  administrators: 'Platform Administrators',
};

/**
 * Egyptian Space Agency Academy — Institutional Admin Header
 * Provides:
 * - Mobile navigation drawer toggle
 * - Desktop sidebar compact rail toggle
 * - Operational breadcrumbs indicating current hierarchy
 * - Division Workspace switcher with Super Admin dropdown and role-based isolation
 * - Real-time notification center
 * - Administrator profile account menu
 */
export default function Navbar({
  onToggleMobileMenu,
  isMobileMenuOpen,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  workspaceSwitcher,
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Division Workspace Switcher dropdown state
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const workspaceRef = useRef(null);

  // Profile Menu state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const profileBtnRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target)) {
        setIsWorkspaceOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    if (isWorkspaceOpen || isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isWorkspaceOpen, isProfileOpen]);

  // Handle escape key to close dropdowns
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isWorkspaceOpen) setIsWorkspaceOpen(false);
        if (isProfileOpen) {
          setIsProfileOpen(false);
          if (profileBtnRef.current) profileBtnRef.current.focus();
        }
      }
    };
    if (isWorkspaceOpen || isProfileOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isWorkspaceOpen, isProfileOpen]);

  // Close dropdowns on route changes
  useEffect(() => {
    setIsWorkspaceOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const currentDivisionMeta = workspaceSwitcher
    ? DIVISION_OPTIONS.find((d) => d.key === workspaceSwitcher.activeDivision) || {
        key: workspaceSwitcher.activeDivision,
        name: `${workspaceSwitcher.activeDivision} Administration`,
        shortName: workspaceSwitcher.activeDivision,
        icon: 'fa-building-columns',
        desc: '',
      }
    : null;

  // Compute breadcrumbs dynamically from current pathname
  const breadcrumbData = useMemo(() => {
    const path = location.pathname;
    const parts = path.split('/').filter(Boolean);

    // E.g. /admin -> parts: ['admin']
    // E.g. /admin/administrators -> parts: ['admin', 'administrators']
    // E.g. /admin/PRE_UNIVERSITY/programs -> parts: ['admin', 'PRE_UNIVERSITY', 'programs']
    const isGateway = path === '/admin';
    const isAdmins = path === '/admin/administrators';
    const divisionPart = parts[1] === 'PRE_UNIVERSITY' || parts[1] === 'UNIVERSITY' ? parts[1] : null;
    const subRoutePart = divisionPart ? parts[2] : (parts[1] !== 'PRE_UNIVERSITY' && parts[1] !== 'UNIVERSITY' ? parts[1] : null);

    let screenTitle = 'Division Dashboard';
    if (isGateway) screenTitle = 'Administration Gateway';
    else if (isAdmins) screenTitle = 'Platform Administrators';
    else if (subRoutePart && ROUTE_TITLES[subRoutePart]) {
      screenTitle = ROUTE_TITLES[subRoutePart];
    } else if (subRoutePart) {
      screenTitle = subRoutePart.charAt(0).toUpperCase() + subRoutePart.slice(1);
    }

    return {
      isGateway,
      divisionPart,
      screenTitle,
    };
  }, [location.pathname]);

  return (
    <header className={styles.navHeader}>
      <nav className={styles.nav} aria-label="Administration Header">
        {/* Left Area: Toggles & Operational Breadcrumbs */}
        <div className={styles.left}>
          {/* Mobile Navigation Drawer Toggle */}
          {user && onToggleMobileMenu && (
            <button
              type="button"
              className={styles.mobileToggle}
              onClick={onToggleMobileMenu}
              title={isMobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
              aria-label={isMobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
              aria-expanded={isMobileMenuOpen}
            >
              <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`} aria-hidden="true" />
            </button>
          )}

          {/* Desktop Compact Sidebar Rail Toggle */}
          {user && onToggleSidebarCollapse && (
            <button
              type="button"
              className={styles.desktopToggle}
              onClick={onToggleSidebarCollapse}
              title={isSidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
              aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <i
                className={`fa-solid ${isSidebarCollapsed ? 'fa-angles-right' : 'fa-bars-staggered'}`}
                aria-hidden="true"
              />
            </button>
          )}

          {/* Operational Breadcrumbs Hierarchy */}
          <div className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link
              to={workspaceSwitcher?.isSuperAdmin ? '/admin' : `/admin/${workspaceSwitcher?.activeDivision || ''}`}
              className={styles.crumbLink}
              title="EGSA Academy Governance"
            >
              <i className="fa-solid fa-server me-1 text-muted" aria-hidden="true" />
              <span>Academy</span>
            </Link>

            {breadcrumbData.divisionPart && (
              <>
                <i className={`fa-solid fa-chevron-right ${styles.crumbSeparator}`} aria-hidden="true" />
                <span
                  className={`${styles.crumbBadge} ${
                    breadcrumbData.divisionPart === 'PRE_UNIVERSITY'
                      ? styles.crumbBadgePreUni
                      : styles.crumbBadgeUni
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      breadcrumbData.divisionPart === 'PRE_UNIVERSITY' ? 'fa-school' : 'fa-graduation-cap'
                    }`}
                    aria-hidden="true"
                  />
                  <span>
                    {breadcrumbData.divisionPart === 'PRE_UNIVERSITY' ? 'Pre-University' : 'University'}
                  </span>
                </span>
              </>
            )}

            <i className={`fa-solid fa-chevron-right ${styles.crumbSeparator}`} aria-hidden="true" />
            <span className={styles.crumbCurrent} aria-current="page">
              {breadcrumbData.screenTitle}
            </span>
          </div>
        </div>

        {/* Right Area: Workspace Switcher, Notifications, Profile Menu */}
        {user && (
          <div className={styles.right}>
            {/* Division Workspace Switcher (Admin exclusive) */}
            {workspaceSwitcher && (
              <div className={styles.workspaceIndicatorWrap} ref={workspaceRef}>
                {workspaceSwitcher.isGateway ? (
                  <>
                    <span className={styles.workspaceLabel}>Platform Mode</span>
                    <div
                      className={styles.workspaceStaticGateway}
                      title="Administration Gateway: Super Admin Platform Mode"
                    >
                      <i className="fa-solid fa-server text-info" aria-hidden="true" />
                      <span className={styles.workspaceName}>Administration Gateway</span>
                    </div>
                  </>
                ) : currentDivisionMeta ? (
                  <>
                    <span className={styles.workspaceLabel}>Active Workspace</span>
                    {workspaceSwitcher.isSuperAdmin ? (
                      <button
                        type="button"
                        id="topbar-division-switcher-btn"
                        className={`${styles.workspaceBtn} ${isWorkspaceOpen ? styles.workspaceBtnActive : ''}`}
                        onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                        aria-expanded={isWorkspaceOpen}
                        aria-haspopup="true"
                        aria-label={`Current Workspace: ${currentDivisionMeta.name}. Click to switch division.`}
                        title="Switch Academy Division Workspace"
                      >
                        <i className={`fa-solid ${currentDivisionMeta.icon} ${styles.workspaceIcon}`} aria-hidden="true" />
                        <span className={styles.workspaceName}>{currentDivisionMeta.name}</span>
                        <i
                          className={`fa-solid fa-chevron-down ${styles.workspaceChevron} ${
                            isWorkspaceOpen ? styles.workspaceChevronOpen : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <div
                        className={styles.workspaceStatic}
                        title={`Assigned Workspace: ${currentDivisionMeta.name}`}
                        aria-label={`Current Workspace: ${currentDivisionMeta.name}`}
                      >
                        <i className={`fa-solid ${currentDivisionMeta.icon} ${styles.workspaceIcon}`} aria-hidden="true" />
                        <span className={styles.workspaceName}>{currentDivisionMeta.name}</span>
                      </div>
                    )}

                    {/* Division Switcher Dropdown (Super Admin) */}
                    {workspaceSwitcher.isSuperAdmin && isWorkspaceOpen && (
                      <div
                        className={styles.workspaceDropdown}
                        role="menu"
                        aria-label="Select Academy Division"
                      >
                        <div className={styles.dropdownHeader}>Switch Division Workspace</div>
                        {DIVISION_OPTIONS.map((div) => {
                          const isActive = workspaceSwitcher.activeDivision === div.key;
                          return (
                            <button
                              key={div.key}
                              type="button"
                              role="menuitem"
                              id={`btn-topbar-select-${div.key.toLowerCase().replace(/_/g, '-')}`}
                              className={`${styles.dropdownOption} ${isActive ? styles.dropdownOptionActive : ''}`}
                              onClick={() => {
                                workspaceSwitcher.onSelectDivision(div.key);
                                setIsWorkspaceOpen(false);
                              }}
                            >
                              <div className={styles.optionHeader}>
                                <i className={`fa-solid ${div.icon} ${styles.optionIcon} me-2`} aria-hidden="true" />
                                <span className={styles.optionTitle}>{div.name}</span>
                                {isActive && (
                                  <i className="fa-solid fa-check ms-auto text-info" aria-hidden="true" />
                                )}
                              </div>
                              <div className={styles.optionDesc}>{div.desc}</div>
                            </button>
                          );
                        })}

                        <div className={styles.dropdownDivider} aria-hidden="true" />

                        <button
                          type="button"
                          role="menuitem"
                          className={styles.dropdownOptionGateway}
                          onClick={() => {
                            setIsWorkspaceOpen(false);
                            if (workspaceSwitcher.onExitToGateway) {
                              workspaceSwitcher.onExitToGateway();
                            } else {
                              navigate('/admin');
                            }
                          }}
                        >
                          <div className={styles.optionHeader}>
                            <i className="fa-solid fa-server me-2" aria-hidden="true" />
                            <span className={styles.optionTitle}>Administration Gateway</span>
                          </div>
                          <div className={styles.optionDesc}>Exit workspace to division selection</div>
                        </button>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Notification Center */}
            <div className={styles.bellWrap}>
              <NotificationBell />
            </div>

            {/* Administrator Profile Account Menu */}
            <div className={styles.profileMenuWrap} ref={profileMenuRef}>
              <button
                ref={profileBtnRef}
                type="button"
                className={`${styles.profileBtn} ${isProfileOpen ? styles.profileBtnActive : ''}`}
                onClick={() => setIsProfileOpen((prev) => !prev)}
                aria-label="User account menu"
                aria-expanded={isProfileOpen}
                aria-haspopup="true"
                id="btn-user-profile-menu"
                title={`Account: ${user.fullName} (${user.role.replace(/_/g, ' ')})`}
              >
                <div className={styles.profileAvatarIcon}>
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : <i className="fa-solid fa-user" />}
                </div>
                <span className={styles.profileLabelName}>{user.fullName || 'Admin'}</span>
                <i
                  className={`fa-solid fa-chevron-down ${styles.profileChevron} ${
                    isProfileOpen ? styles.chevronRotated : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {isProfileOpen && (
                <div
                  className={styles.profileDropdown}
                  role="menu"
                  aria-label="User Account Menu"
                  id="dropdown-user-profile"
                >
                  <div className={styles.profileMenuHeader}>
                    <div className={styles.profileMenuName}>{user.fullName}</div>
                    <div className={styles.profileMenuRole}>
                      Role: <span className={styles.profileRoleBadge}>{user.role.replace(/_/g, ' ')}</span>
                    </div>
                    {user.email && (
                      <div className={styles.profileMenuEmail}>{user.email}</div>
                    )}
                  </div>

                  <div className={styles.dropdownDivider} aria-hidden="true" />

                  <button
                    type="button"
                    role="menuitem"
                    className={styles.profileLogoutItem}
                    onClick={() => {
                      setIsProfileOpen(false);
                      handleLogout();
                    }}
                    id="btn-profile-logout"
                  >
                    <i className="fa-solid fa-right-from-bracket me-2" aria-hidden="true" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
