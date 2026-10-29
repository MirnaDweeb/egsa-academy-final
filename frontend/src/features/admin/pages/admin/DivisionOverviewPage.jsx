import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import adminService from '../../services/api/adminService';
import { DIVISION_LABELS } from '../../constants/divisions';
import styles from './DivisionOverviewPage.module.css';

/**
 * Maps audit actions to distinct visual icons
 */
function getActionIcon(action) {
  if (!action) return 'fa-clock-rotate-left';
  if (action.includes('STUDENT')) return 'fa-user-graduate';
  if (action.includes('PROGRAM')) return 'fa-book-open';
  if (action.includes('COHORT')) return 'fa-people-group';
  if (action.includes('SESSION')) return 'fa-tower-broadcast';
  if (action.includes('ATTENDANCE')) return 'fa-clipboard-user';
  if (action.includes('APPLICATION') || action.includes('READINESS')) return 'fa-file-lines';
  if (action.includes('CERTIFICATE')) return 'fa-certificate';
  if (action.includes('INVOICE') || action.includes('PAYMENT')) return 'fa-receipt';
  if (action.includes('INSTRUCTOR')) return 'fa-chalkboard-user';
  if (action.includes('NOTIFICATION') || action.includes('MESSAGE') || action.includes('REMINDER')) return 'fa-bell';
  if (action.includes('ADMIN')) return 'fa-user-shield';
  return 'fa-shield-halved';
}

/**
 * Formats ISO date into human-readable date & time
 */
function formatSessionDate(dateStr, startTime) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const formattedDate = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return startTime ? `${formattedDate} · ${startTime}` : formattedDate;
}

/**
 * Human-readable relative time formatting (e.g., '10m ago', '2h ago')
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DivisionOverviewPage() {
  const { division } = useParams();
  const normDivision = (division || '').replace(/-/g, '_').toUpperCase();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const result = await adminService.getDivisionOverview(normDivision);
      setStats(result);
    } catch (err) {
      setError(err.message || 'Failed to load division overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normDivision]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingState message="Loading division overview..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => load(false)} />;
  }

  const divisionName = DIVISION_LABELS[normDivision] || normDivision;
  const isUni = normDivision === 'UNIVERSITY';
  const upcomingSessions = stats?.upcomingSessions || [];
  const recentActivity = stats?.recentActivity || [];
  const recentApplications = stats?.recentApplications || [];
  const appBreakdown = stats?.applicationBreakdown || {};

  return (
    <div className={styles.dashboardContainer}>
      {/* 1. Page Introduction Header (Open, Spacious Canvas Header) */}
      <header className={styles.pageHeader}>
        <div className={styles.headerInfo}>
          <div className={styles.categoryBreadcrumb}>
            <span className={styles.orgTag}>Egyptian Space Agency Academy</span>
            <span className={styles.bulletSeparator}>·</span>
            <span className={`${styles.divisionBadge} ${isUni ? styles.badgeUni : styles.badgePreUni}`}>
              <i className={`fa-solid ${isUni ? 'fa-graduation-cap' : 'fa-school'}`} aria-hidden="true"></i>
              {divisionName}
            </span>
            <span className={styles.bulletSeparator}>·</span>
            <span className={styles.liveIndicator}>
              <span className={styles.liveDot}></span>
              Live Synced
            </span>
          </div>

          <h1 className={styles.pageTitle}>{divisionName} Command Overview</h1>
          <p className={styles.pageDescription}>
            Operational oversight of students, active curricula, live sessions, and the admissions pipeline.
          </p>
        </div>

        <div className={styles.headerControls}>
          <button
            type="button"
            className={styles.syncBtn}
            onClick={() => load(true)}
            disabled={refreshing}
            title="Sync latest live database metrics"
            aria-label="Refresh Dashboard Data"
          >
            <i className={`fa-solid fa-rotate-right ${refreshing ? 'fa-spin' : ''}`} aria-hidden="true"></i>
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
          <Link
            to={`/admin/${normDivision}/sessions`}
            className="btn btn-outline-primary btn-sm"
            title="View all scheduled and live sessions"
          >
            <i className="fa-solid fa-tower-broadcast me-1.5" aria-hidden="true"></i>
            Live Sessions
          </Link>
          <Link
            to={`/admin/${normDivision}/applications`}
            className="btn btn-primary btn-sm"
            title="Review student applications"
          >
            <i className="fa-solid fa-file-lines me-1.5" aria-hidden="true"></i>
            Applications
          </Link>
        </div>
      </header>

      {/* 2. Primary Operational Pillars (4 High-Hierarchy Metrics with Integrated Context) */}
      <section className={styles.kpiGrid} aria-label="Key Operational Metrics">
        {/* Metric 1: Students */}
        <Link to={`/admin/${normDivision}/students`} className={`${styles.kpiCard} ${styles.kpiCardTeal}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Enrolled Trainees</span>
            <div className={`${styles.kpiIconWrap} ${styles.iconTeal}`}>
              <i className="fa-solid fa-user-graduate" aria-hidden="true"></i>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats?.studentCount ?? 0}</div>
          <div className={styles.kpiContext}>
            <i className="fa-solid fa-circle-check text-muted" aria-hidden="true"></i>
            <span>Active division cadets</span>
          </div>
        </Link>

        {/* Metric 2: Curricula */}
        <Link to={`/admin/${normDivision}/programs`} className={`${styles.kpiCard} ${styles.kpiCardGold}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Active Curricula</span>
            <div className={`${styles.kpiIconWrap} ${styles.iconGold}`}>
              <i className="fa-solid fa-book-open" aria-hidden="true"></i>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats?.activePrograms ?? 0}</div>
          <div className={styles.kpiContext}>
            <i className="fa-solid fa-certificate text-muted" aria-hidden="true"></i>
            <span>{stats?.issuedCertificatesCount ?? 0} certificates issued</span>
          </div>
        </Link>

        {/* Metric 3: Cohorts & Sessions */}
        <Link to={`/admin/${normDivision}/cohorts`} className={`${styles.kpiCard} ${styles.kpiCardBlue}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Active Cohorts</span>
            <div className={`${styles.kpiIconWrap} ${styles.iconBlue}`}>
              <i className="fa-solid fa-people-group" aria-hidden="true"></i>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats?.activeCohorts ?? 0}</div>
          <div className={styles.kpiContext}>
            <i className="fa-solid fa-calendar-days text-muted" aria-hidden="true"></i>
            <span>{stats?.upcomingSessionsCount ?? 0} upcoming · {stats?.completedSessionsCount ?? 0} completed</span>
          </div>
        </Link>

        {/* Metric 4: Admissions Review (Action Priority) */}
        <Link
          to={`/admin/${normDivision}/applications`}
          className={`${styles.kpiCard} ${stats?.pendingApplications > 0 ? styles.kpiCardAlert : styles.kpiCardDefault}`}
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Pending Applications</span>
            <div className={`${styles.kpiIconWrap} ${stats?.pendingApplications > 0 ? styles.iconCoral : styles.iconMuted}`}>
              <i className="fa-solid fa-id-card" aria-hidden="true"></i>
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{stats?.pendingApplications ?? 0}</span>
            {stats?.pendingApplications > 0 && (
              <span className={styles.actionChip}>Action Needed</span>
            )}
          </div>
          <div className={styles.kpiContext}>
            <i className="fa-solid fa-file-invoice text-muted" aria-hidden="true"></i>
            <span>{stats?.totalApplicationsCount ?? 0} total applications</span>
          </div>
        </Link>
      </section>

      {/* 3. Streamlined Admissions Pipeline Funnel */}
      <section className={styles.sectionPanel} aria-labelledby="admissions-pipeline-heading">
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleGroup}>
            <i className={`fa-solid fa-bars-progress ${styles.panelIcon}`} aria-hidden="true"></i>
            <div>
              <h2 id="admissions-pipeline-heading" className={styles.panelTitle}>
                Admissions Pipeline Status
              </h2>
              <span className={styles.panelSubtitle}>
                Real candidate flow across all admissions review stages
              </span>
            </div>
          </div>
          <Link
            to={`/admin/${normDivision}/applications`}
            className={styles.headerLink}
            title="Open complete applications manager"
          >
            <span>Manage Applications</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </Link>
        </div>

        <div className={styles.pipelineTrack}>
          {/* Stage 1: Submitted */}
          <Link to={`/admin/${normDivision}/applications`} className={styles.pipelineStage}>
            <div className={styles.stageTop}>
              <span className={`${styles.stageDot} ${styles.dotSubmitted}`}></span>
              <span className={styles.stageLabel}>Submitted</span>
            </div>
            <div className={styles.stageCount}>{appBreakdown.SUBMITTED ?? 0}</div>
            <div className={styles.stageNote}>New entries</div>
          </Link>

          {/* Stage 2: Manual Review */}
          <Link
            to={`/admin/${normDivision}/applications`}
            className={`${styles.pipelineStage} ${(appBreakdown.MANUAL_REVIEW ?? 0) > 0 ? styles.stageHighlighted : ''}`}
          >
            <div className={styles.stageTop}>
              <span className={`${styles.stageDot} ${styles.dotReview}`}></span>
              <span className={styles.stageLabel}>Manual Review</span>
            </div>
            <div className={styles.stageCount}>{appBreakdown.MANUAL_REVIEW ?? 0}</div>
            <div className={styles.stageNote}>Awaiting decision</div>
          </Link>

          {/* Stage 3: Payment Pending */}
          <Link
            to={`/admin/${normDivision}/applications`}
            className={`${styles.pipelineStage} ${(appBreakdown.ELIGIBLE_PAYMENT_PENDING ?? 0) > 0 ? styles.stageHighlightedBlue : ''}`}
          >
            <div className={styles.stageTop}>
              <span className={`${styles.stageDot} ${styles.dotPayment}`}></span>
              <span className={styles.stageLabel}>Payment Pending</span>
            </div>
            <div className={styles.stageCount}>{appBreakdown.ELIGIBLE_PAYMENT_PENDING ?? 0}</div>
            <div className={styles.stageNote}>Eligible candidates</div>
          </Link>

          {/* Stage 4: Confirmed */}
          <Link to={`/admin/${normDivision}/applications`} className={styles.pipelineStage}>
            <div className={styles.stageTop}>
              <span className={`${styles.stageDot} ${styles.dotConfirmed}`}></span>
              <span className={styles.stageLabel}>Confirmed</span>
            </div>
            <div className={styles.stageCount}>{appBreakdown.CONFIRMED ?? 0}</div>
            <div className={styles.stageNote}>Enrolled trainees</div>
          </Link>

          {/* Stage 5: Waitlisted */}
          <Link to={`/admin/${normDivision}/applications`} className={styles.pipelineStage}>
            <div className={styles.stageTop}>
              <span className={`${styles.stageDot} ${styles.dotWaitlist}`}></span>
              <span className={styles.stageLabel}>Waitlisted</span>
            </div>
            <div className={styles.stageCount}>{appBreakdown.WAITLISTED ?? 0}</div>
            <div className={styles.stageNote}>Reserve roster</div>
          </Link>

          {/* Stage 6: Cancelled */}
          <Link to={`/admin/${normDivision}/applications`} className={styles.pipelineStage}>
            <div className={styles.stageTop}>
              <span className={`${styles.stageDot} ${styles.dotCancelled}`}></span>
              <span className={styles.stageLabel}>Cancelled</span>
            </div>
            <div className={styles.stageCount}>{appBreakdown.CANCELLED ?? 0}</div>
            <div className={styles.stageNote}>Withdrawn / Closed</div>
          </Link>
        </div>
      </section>

      {/* 4. Primary Workstations (Academic Sessions Schedule & Administrative Activity) */}
      <div className={styles.workstationsGrid}>
        {/* Left Column: Academic Delivery Schedule */}
        <section className={styles.sectionPanel} aria-labelledby="upcoming-sessions-heading">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <i className={`fa-solid fa-calendar-days ${styles.panelIcon}`} aria-hidden="true"></i>
              <div>
                <h2 id="upcoming-sessions-heading" className={styles.panelTitle}>
                  Academic Delivery Schedule
                </h2>
                <span className={styles.panelSubtitle}>
                  Scheduled and active training sessions
                </span>
              </div>
            </div>
            <Link
              to={`/admin/${normDivision}/sessions`}
              className={styles.headerLink}
              title="Navigate to Session Monitoring Dashboard"
            >
              <span>View all ({stats?.upcomingSessionsCount ?? upcomingSessions.length})</span>
              <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </Link>
          </div>

          <div className={styles.panelContent}>
            {upcomingSessions.length > 0 ? (
              <div className={styles.sessionRowsList}>
                {upcomingSessions.map((session) => (
                  <div key={session.sessionId || session._id} className={styles.sessionRow}>
                    <div className={styles.sessionMain}>
                      <div className={styles.sessionHeaderRow}>
                        <span className={styles.sessionBadge}>Session {session.sessionNumber}</span>
                        <h3 className={styles.sessionTopicTitle}>{session.topic}</h3>
                        <StatusBadge status={session.status} />
                      </div>

                      <div className={styles.sessionMetaStrip}>
                        <span className={styles.sessionMetaItem}>
                          <i className="fa-solid fa-graduation-cap text-muted" aria-hidden="true"></i>
                          <span className={styles.programCohortText}>
                            {session.cohortNumber} · {session.programTitle}
                          </span>
                        </span>
                        <span className={styles.sessionMetaItem}>
                          <i className="fa-solid fa-calendar text-muted" aria-hidden="true"></i>
                          <span>{formatSessionDate(session.date, session.startTime)}</span>
                        </span>
                        <span className={styles.sessionMetaItem}>
                          <i className="fa-solid fa-chalkboard-user text-muted" aria-hidden="true"></i>
                          <span>{session.instructorName || 'Assigned Instructor'}</span>
                        </span>
                        <span className={styles.sessionMetaItem}>
                          <i
                            className={`fa-solid ${session.deliveryMode === 'ONLINE' ? 'fa-video' : 'fa-location-dot'} text-muted`}
                            aria-hidden="true"
                          ></i>
                          <span>{session.deliveryMode}{session.location ? ` (${session.location})` : ''}</span>
                        </span>
                      </div>
                    </div>

                    <div className={styles.sessionActionCol}>
                      <Link
                        to={`/admin/${normDivision}/sessions`}
                        className={styles.monitorBtn}
                        title={`Monitor live academic session ${session.sessionNumber}`}
                      >
                        <span>Monitor</span>
                        <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyContainer}>
                <EmptyState
                  icon="fa-calendar-days"
                  title="No sessions scheduled"
                  description="There are no upcoming scheduled sessions in this division. Sessions will appear here once scheduled for active cohorts."
                />
                <Link
                  to={`/admin/${normDivision}/cohorts`}
                  className={styles.emptyActionLink}
                  title="Manage training cohorts"
                >
                  <i className="fa-solid fa-people-group me-1.5" aria-hidden="true"></i>
                  <span>Manage Cohorts & Scheduling</span>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Security Audit & Administrative Activity Timeline */}
        <section className={styles.sectionPanel} aria-labelledby="recent-activity-heading">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <i className={`fa-solid fa-clock-rotate-left ${styles.panelIcon}`} aria-hidden="true"></i>
              <div>
                <h2 id="recent-activity-heading" className={styles.panelTitle}>
                  Administrative Activity
                </h2>
                <span className={styles.panelSubtitle}>
                  Institutional audit trail of security & governance events
                </span>
              </div>
            </div>
            <Link
              to={`/admin/${normDivision}/audit-logs`}
              className={styles.headerLink}
              title="Navigate to Security Audit Logs"
            >
              <span>Full audit log</span>
              <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </Link>
          </div>

          <div className={styles.panelContent}>
            {recentActivity.length > 0 ? (
              <div className={styles.activityTimeline}>
                {recentActivity.map((activity, idx) => (
                  <div key={activity._id || idx} className={styles.timelineItem}>
                    <div className={styles.timelineTrackCol}>
                      <div className={styles.timelineIconBubble}>
                        <i className={`fa-solid ${getActionIcon(activity.action)}`}></i>
                      </div>
                      {idx < recentActivity.length - 1 && <div className={styles.timelineLine}></div>}
                    </div>

                    <div className={styles.timelineBody}>
                      <div className={styles.timelineHeader}>
                        <span className={styles.timelineAction}>{activity.actionLabel || activity.action}</span>
                        <span className={styles.timelineTime} title={new Date(activity.timestamp).toLocaleString()}>
                          {formatRelativeTime(activity.timestamp)}
                        </span>
                      </div>

                      <div className={styles.timelineActorRow}>
                        <span className={styles.actorName}>{activity.actor?.fullName || 'System Administrator'}</span>
                        {activity.actor?.role && (
                          <span className={styles.actorRoleTag}>{activity.actor.role.replace(/_/g, ' ')}</span>
                        )}
                      </div>

                      {activity.reason && (
                        <div className={styles.timelineReason} title={activity.reason}>
                          {activity.reason}
                        </div>
                      )}

                      {activity.link && (
                        <div className={styles.timelineLinkWrap}>
                          <Link to={activity.link} className={styles.timelineLink}>
                            <span>Inspect Entity</span>
                            <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyContainer}>
                <EmptyState
                  icon="fa-clock-rotate-left"
                  title="No recent activity logged"
                  description="Administrative actions and security events will automatically appear here as operations are performed."
                />
                <Link
                  to={`/admin/${normDivision}/audit-logs`}
                  className={styles.emptyActionLink}
                  title="Inspect audit log repository"
                >
                  <i className="fa-solid fa-shield-halved me-1.5" aria-hidden="true"></i>
                  <span>Inspect Security Audit Logs</span>
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 5. Recent Applications Queue Table */}
      <section className={styles.sectionPanel} aria-labelledby="recent-applications-heading">
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleGroup}>
            <i className={`fa-solid fa-user-plus ${styles.panelIcon}`} aria-hidden="true"></i>
            <div>
              <h2 id="recent-applications-heading" className={styles.panelTitle}>
                Recent Applications Queue
              </h2>
              <span className={styles.panelSubtitle}>
                Latest applicants seeking admission into {divisionName} curricula
              </span>
            </div>
          </div>
          <Link
            to={`/admin/${normDivision}/applications`}
            className={styles.headerLink}
            title="Review all student applications"
          >
            <span>All Applications</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </Link>
        </div>

        <div className={styles.tableWrap}>
          {recentApplications.length > 0 ? (
            <table className={styles.rosterTable}>
              <thead>
                <tr>
                  <th scope="col">Applicant</th>
                  <th scope="col">Program Track</th>
                  <th scope="col">Status</th>
                  <th scope="col">Submitted</th>
                  <th scope="col" className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.map((app) => (
                  <tr key={app._id}>
                    <td>
                      <div className={styles.applicantName}>{app.studentName}</div>
                      {app.studentEmail && (
                        <div className={styles.applicantEmail}>{app.studentEmail}</div>
                      )}
                    </td>
                    <td>
                      <div className={styles.programTitle} title={app.programTitle}>
                        {app.programTitle}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={app.status} />
                    </td>
                    <td title={app.createdAt ? new Date(app.createdAt).toLocaleString() : ''}>
                      <span className={styles.relativeTime}>{formatRelativeTime(app.createdAt)}</span>
                    </td>
                    <td className="text-end">
                      <Link
                        to={`/admin/${normDivision}/applications`}
                        className="btn btn-outline-primary btn-sm py-1 px-3"
                        title={`Review application from ${app.studentName}`}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyContainer}>
              <EmptyState
                icon="fa-file-lines"
                title="No applications submitted yet"
                description="Student applications will appear here as candidates submit registrations for active curricula."
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
