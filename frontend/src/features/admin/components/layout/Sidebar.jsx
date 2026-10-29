import { useState, useEffect, useId } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { ROLES } from '../../constants/roles';
import styles from './Sidebar.module.css';

/**
 * Egyptian Space Agency Academy — Institutional Admin Sidebar
 * Primary navigation system supporting:
 * - Fixed Brand Header with official logo and active division badge
 * - Hierarchical, collapsible navigation groups with Font Awesome icons
 * - High-contrast active route recognition with glowing indicators
 * - Desktop Compact Rail Mode (persisted) with accessible tooltips
 * - Mobile & Tablet Off-Canvas Drawer with accessible backdrop and dismiss controls
 * - Fixed Bottom Utility area with administrator profile snippet and rail toggle
 */
export default function Sidebar({
  items,
  sections,
  label,
  activeDivision,
  isMobileOpen,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
  onBackToGateway,
  isSuperAdmin = false,
  user,
}) {
  const location = useLocation();
  const idPrefix = useId();

  // Track open/collapsed state for collapsible sections
  const [openSections, setOpenSections] = useState(() => {
    if (!sections) return {};
    const initial = {};
    sections.forEach((sec) => {
      initial[sec.title] = sec.defaultOpen !== false;
    });
    return initial;
  });

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  // Prevent background body scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobileOpen]);

  // Automatically expand the relevant parent group when navigating to a nested route
  useEffect(() => {
    if (!sections || sections.length === 0) return;

    sections.forEach((section) => {
      if (!section.items || section.items.length === 0) return;

      const hasActiveChild = section.items.some((item) => {
        if (item.end) {
          return location.pathname === item.to;
        }
        return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
      });

      if (hasActiveChild) {
        setOpenSections((prev) => ({
          ...prev,
          [section.title]: true,
        }));
      }
    });
  }, [location.pathname, sections]);

  const toggleSection = (title) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleLinkClick = () => {
    // Automatically close mobile drawer when user navigates
    if (isMobileOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  // Division badge configuration
  const divisionTag = activeDivision === 'PRE_UNIVERSITY'
    ? { label: 'Pre-University', class: styles.badgePreUni, icon: 'fa-school' }
    : activeDivision === 'UNIVERSITY'
    ? { label: 'University', class: styles.badgeUni, icon: 'fa-graduation-cap' }
    : isSuperAdmin
    ? { label: 'Super Admin', class: styles.badgeSuperAdmin, icon: 'fa-shield-halved' }
    : null;

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.sidebarRail : ''} ${
          isMobileOpen ? styles.sidebarMobileOpen : ''
        }`}
        aria-label="Admin Navigation Sidebar"
      >
        {/* 1. Brand Header (Fixed at top) */}
        <div className={styles.brandHeader}>
          <Link
            to={isSuperAdmin ? '/admin' : `/admin/${activeDivision || ''}`}
            className={styles.brandLink}
            onClick={handleLinkClick}
            title="Egyptian Space Agency Academy"
          >
            <img
              src="/egsa-logo.png"
              alt="EGSA Logo"
              className={styles.brandLogoImg}
            />
            {!isCollapsed && (
              <div className={styles.brandMeta}>
                <span className={styles.brandTitle}>EGSA ACADEMY</span>
                <span className={styles.brandAgency}>EGYPTIAN SPACE AGENCY</span>
              </div>
            )}
          </Link>

          {/* Mobile Drawer Close Button */}
          {isMobileOpen && (
            <button
              type="button"
              className={styles.mobileCloseBtn}
              onClick={onCloseMobile}
              title="Close Navigation"
              aria-label="Close Navigation Menu"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Workspace Tag Sub-bar */}
        {!isCollapsed && divisionTag && (
          <div className={styles.workspaceTagBar}>
            <span className={`${styles.workspaceBadge} ${divisionTag.class}`}>
              <i className={`fa-solid ${divisionTag.icon}`} aria-hidden="true" />
              <span>{divisionTag.label}</span>
            </span>
            <span className="text-white-50 small" style={{ fontSize: '0.62rem' }}>
              WORKSPACE
            </span>
          </div>
        )}

        {/* Top Action (Super Admin Gateway return button) */}
        {isSuperAdmin && onBackToGateway && (
          <div className={styles.topActionWrap}>
            <button
              type="button"
              className={styles.gatewayReturnBtn}
              onClick={() => {
                handleLinkClick();
                onBackToGateway();
              }}
              title="Return to Administration Gateway"
              aria-label="Back to Administration Gateway"
            >
              <i className="fa-solid fa-server me-1.5" aria-hidden="true" />
              {!isCollapsed && <span>Administration Gateway</span>}
            </button>
          </div>
        )}

        {/* 2. Scrollable Middle Navigation Region */}
        <div className={styles.sectionsContainer}>
          {sections && sections.length > 0 ? (
            sections.map((section, sIdx) => {
              const isOpen = openSections[section.title] !== false;
              const isCollapsible = section.collapsible !== false && section.items && section.items.length > 0;
              const sectionId = `${idPrefix}-sec-${sIdx}`;

              // Highlight group if any child is active
              const containsActive = section.items?.some((item) => {
                if (item.end) return location.pathname === item.to;
                return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
              });

              return (
                <div key={section.title} className={styles.sectionGroup}>
                  {/* Collapsible Section Header */}
                  {!isCollapsed && isCollapsible ? (
                    <button
                      type="button"
                      id={`btn-${sectionId}`}
                      className={`${styles.sectionHeader} ${containsActive ? styles.sectionHeaderHasActive : ''}`}
                      onClick={() => toggleSection(section.title)}
                      aria-expanded={isOpen}
                      aria-controls={sectionId}
                    >
                      <span className={styles.sectionTitleWrap}>
                        {section.icon && (
                          <i className={`fa-solid ${section.icon} ${styles.headerIcon}`} aria-hidden="true" />
                        )}
                        <span>{section.title}</span>
                      </span>
                      <i
                        className={`fa-solid fa-chevron-down ${styles.chevron} ${
                          isOpen ? styles.chevronOpen : styles.chevronClosed
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  ) : !isCollapsed && section.title ? (
                    <div className={styles.sectionHeader}>
                      <span className={styles.sectionTitleWrap}>
                        {section.icon && (
                          <i className={`fa-solid ${section.icon} ${styles.headerIcon}`} aria-hidden="true" />
                        )}
                        <span>{section.title}</span>
                      </span>
                    </div>
                  ) : (
                    <div className={styles.railDivider} title={section.title} />
                  )}

                  {/* Section Links */}
                  {section.items && section.items.length > 0 && (
                    <div
                      id={sectionId}
                      role="region"
                      aria-labelledby={`btn-${sectionId}`}
                      className={`${styles.sectionBody} ${
                        !isOpen && !isCollapsed ? styles.sectionBodyCollapsed : ''
                      }`}
                    >
                      <div className={styles.sectionInner}>
                        {section.items.map((item) => (
                          <NavLink
                            key={`${section.title}-${item.label}-${item.to}`}
                            to={item.to}
                            end={item.end}
                            title={isCollapsed ? item.label : undefined}
                            onClick={handleLinkClick}
                            className={({ isActive }) =>
                              `${styles.link} ${isCollapsible && !isCollapsed ? styles.subLink : ''} ${
                                isActive ? styles.linkActive : ''
                              } ${isCollapsed ? styles.linkRail : ''}`
                            }
                          >
                            <span className={styles.linkIconWrap}>
                              <i className={`fa-solid ${item.icon} ${styles.linkIcon}`} aria-hidden="true" />
                            </span>
                            {!isCollapsed && <span className={styles.linkLabel}>{item.label}</span>}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            items &&
            items.map((item) => (
              <NavLink
                key={`${item.label}-${item.to}`}
                to={item.to}
                end={item.end}
                onClick={handleLinkClick}
                className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={styles.linkIconWrap}>
                  <i className={`fa-solid ${item.icon} ${styles.linkIcon}`} aria-hidden="true" />
                </span>
                {!isCollapsed && <span className={styles.linkLabel}>{item.label}</span>}
              </NavLink>
            ))
          )}
        </div>

        {/* 3. Bottom Utility Area (Fixed at bottom) */}
        <div className={styles.bottomUtility}>
          {user && !isCollapsed && (
            <div className={styles.userSnippet}>
              <div className={styles.userAvatar}>
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : <i className="fa-solid fa-user-shield" />}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.fullName || 'Administrator'}</span>
                <span className={styles.userRole}>
                  {(user.role || 'ADMIN').replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          )}

          {/* Desktop Rail Expand / Collapse Toggle Button */}
          {onToggleCollapse && (
            <button
              type="button"
              className={styles.collapseToggleBtn}
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
              aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <i
                className={`fa-solid ${isCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`}
                aria-hidden="true"
              />
              {!isCollapsed && <span>Collapse Sidebar</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
