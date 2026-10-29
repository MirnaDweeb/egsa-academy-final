import { Link } from 'react-router-dom';
import styles from './StatCard.module.css';

export default function StatCard({
  icon,
  label,
  title,
  value,
  subtitle,
  helper,
  tone = 'default',
  badge,
  badgeTone = 'default',
  linkTo,
}) {
  const displayLabel = title || label;
  const displaySub = subtitle || helper || (title && label ? label : null);

  const cardContent = (
    <>
      <div className={styles.topRow}>
        <div className={styles.iconWrap}>
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        </div>
        {badge && (
          <span className={`${styles.badge} ${styles[`badge_${badgeTone}`]}`}>
            {badge}
          </span>
        )}
      </div>
      <div className={styles.metaWrap}>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{displayLabel}</div>
        {displaySub && <div className={styles.subtext}>{displaySub}</div>}
      </div>
    </>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className={`${styles.card} ${styles.clickableCard} ${styles[tone]}`}
        title={`View ${displayLabel}`}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div className={`${styles.card} ${styles[tone]}`}>
      {cardContent}
    </div>
  );
}
