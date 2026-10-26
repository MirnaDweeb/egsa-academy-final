import { useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../constants/roles';
import { PERMISSIONS } from '../../constants/permissions';
import { ROLE_TO_DIVISION, DIVISION_LABELS } from '../../constants/divisions';
import ManualPaymentReviewsTab from '../../components/finance/ManualPaymentReviewsTab';
import styles from './FinancePage.module.css';

export default function FinancePage() {
  const { user } = useAuth();
  const params = useParams();
  const activeDivision = params.division || ROLE_TO_DIVISION[user?.role] || 'all';

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const canManageFinance = isSuperAdmin || user?.permissions?.includes(PERMISSIONS.FINANCE_MANAGE);

  const divisionTitle =
    activeDivision && activeDivision !== 'all'
      ? `${DIVISION_LABELS[activeDivision] || activeDivision} Manual Payment Reviews`
      : 'Manual Payment Reviews (Vodafone Cash / InstaPay)';

  return (
    <div className={styles.container}>
      <PageHeader
        title={divisionTitle}
        subtitle="Review, audit, and approve student payment receipts transferred via Vodafone Cash and InstaPay to finalize course enrollments."
      />
      <ManualPaymentReviewsTab canManageFinance={canManageFinance} />
    </div>
  );
}
