import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentService, applicationService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';
import styles from './PaymentsPage.module.css';

/**
 * Safely format numeric monetary amounts for UI presentation.
 * Returns '—' if amount is null, undefined, or NaN.
 */
function formatAmount(val) {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString();
}

/**
 * Safely format date-time strings for UI presentation.
 * Returns '—' if date is missing or invalid.
 */
function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

/**
 * Safely format date strings for UI presentation.
 * Returns '—' if date is missing or invalid.
 */
function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

/**
 * Egyptian Space Agency — National Space Technology Training Platform
 * Student Course Payments, Custom Card Checkout & Financial Ledger
 */
export default function PaymentsPage() {
  const { user, language = 'en', isRTL } = useAuth();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const queryAppId = searchParams.get('applicationId');
  const queryInvoiceId = searchParams.get('invoiceId');

  const [invoices, setInvoices] = useState([]);
  const [applications, setApplications] = useState([]);
  const [myRefunds, setMyRefunds] = useState([]);
  const [refundAccount, setRefundAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pending', 'paid', 'refunds'

  // Active payment checkout state (selected payable invoice)
  const [checkoutTarget, setCheckoutTarget] = useState(null); // { invoice, application, course, cohort }
  const [selectedPackage, setSelectedPackage] = useState('WITHOUT_TRANSPORTATION');
  const [checkoutStep, setCheckoutStep] = useState('idle'); // 'idle', 'initiating', 'embedded_ready', 'processing', 'failed'
  const [checkoutError, setCheckoutError] = useState('');
  const [calculatedPricing, setCalculatedPricing] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Embedded Gateway Card Checkout Component state
  const [embeddedCheckout, setEmbeddedCheckout] = useState(null); // { iframeUrl, paymentUrl, orderId, paymentKey, isMock }

  // Official Receipt Modal & Return Settlement Flow states
  const [receiptData, setReceiptData] = useState(null);
  const [paymentSessionFlow, setPaymentSessionFlow] = useState(null); // null | 'processing' | 'confirmed' | 'failed' | 'cancelled' | 'requires_refund' | 'timeout'
  const [flowDetails, setFlowDetails] = useState(null);
  const [pollAttempt, setPollAttempt] = useState(0);

  // Refund Management Modals
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountFormData, setAccountFormData] = useState({
    accountHolderName: '',
    refundMethod: 'ORIGINAL_PAYMENT_METHOD',
    bankName: '',
    accountNumber: '',
    iban: '',
  });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');

  // Student Refund Request Modal
  const [refundTargetInvoice, setRefundTargetInvoice] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundModalError, setRefundModalError] = useState('');

  // Manual Payment Method & Proof Submission States (Vodafone Cash & InstaPay)
  const [paymentMethod, setPaymentMethod] = useState('CARD'); // 'CARD' | 'VODAFONE_CASH' | 'INSTAPAY'
  const [manualSettings, setManualSettings] = useState(null);
  const [myProofsList, setMyProofsList] = useState([]);
  const [senderIdentifier, setSenderIdentifier] = useState('');
  const [txReference, setTxReference] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState('');
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofError, setProofError] = useState('');
  const [proofSuccess, setProofSuccess] = useState('');
  const [forceResubmit, setForceResubmit] = useState(false);
  const [viewingProofFile, setViewingProofFile] = useState(null);
  const [viewingBlobUrl, setViewingBlobUrl] = useState('');
  const [viewingBlobLoading, setViewingBlobLoading] = useState(false);
  const [viewingBlobError, setViewingBlobError] = useState('');

  const dismissFlowState = () => {
    setPaymentSessionFlow(null);
    setFlowDetails(null);
    setSearchParams({});
  };

  // Open / Select an invoice for payment
  const openCheckout = (target) => {
    if (!target) return;
    setCheckoutTarget(target);
    setEmbeddedCheckout(null);
    const initialPkg = target.invoice?.packageType || 'WITHOUT_TRANSPORTATION';
    setSelectedPackage(initialPkg);
    setCheckoutStep('idle');
    setCheckoutError('');
    const courseId = target.course?._id || target.invoice?.course?._id;
    if (courseId) {
      fetchCalculatedPrice(courseId, initialPkg, target);
    }
  };

  // Fetch trusted server-side price calculation
  const fetchCalculatedPrice = async (courseId, pkgType, target) => {
    if (!courseId) return;
    setPriceLoading(true);
    try {
      const res = await paymentService.calculatePrice(courseId, pkgType);
      if (res?.data) {
        setCalculatedPricing(res.data);
      }
    } catch {
      const activeCourse = target?.course || checkoutTarget?.course || target?.invoice?.course;
      if (activeCourse) {
        const base = Number(activeCourse.price) || 0;
        const trans = Number(activeCourse.transportationPrice) || 0;
        setCalculatedPricing({
          basePrice: base,
          transportationPrice: trans,
          packageType: pkgType,
          totalAmount: pkgType === 'WITH_TRANSPORTATION' ? base + trans : base,
          currency: activeCourse.currency || 'EGP',
        });
      }
    } finally {
      setPriceLoading(false);
    }
  };

  const handlePackageChange = (newPkg) => {
    setSelectedPackage(newPkg);
    const courseId = checkoutTarget?.course?._id || checkoutTarget?.invoice?.course?._id;
    if (courseId) {
      fetchCalculatedPrice(courseId, newPkg, checkoutTarget);
    }
  };

  // Load invoices, applications, refund account, refunds, manual settings, and payment proofs
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [invRes, appRes, refundAccRes, myRefundsRes, settingsRes, proofsRes] = await Promise.allSettled([
        paymentService.my(),
        applicationService.my(),
        paymentService.getRefundAccount(),
        paymentService.myRefunds(),
        paymentService.getManualSettings(),
        paymentService.myProofs(),
      ]);

      const loadedInvoices = invRes.status === 'fulfilled' ? invRes.value.data || [] : [];
      const loadedApps = appRes.status === 'fulfilled' ? appRes.value.data || [] : [];
      const loadedRefundAcc = refundAccRes.status === 'fulfilled' ? refundAccRes.value.data : null;
      const loadedMyRefunds = myRefundsRes.status === 'fulfilled' ? myRefundsRes.value.data || [] : [];
      const loadedSettings = settingsRes.status === 'fulfilled' ? settingsRes.value.data : null;
      const loadedProofs = proofsRes.status === 'fulfilled' ? proofsRes.value.data || [] : [];

      setInvoices(loadedInvoices);
      setApplications(loadedApps);
      setRefundAccount(loadedRefundAcc);
      setMyRefunds(loadedMyRefunds);
      setManualSettings(loadedSettings);
      setMyProofsList(loadedProofs);

      if (loadedRefundAcc) {
        setAccountFormData({
          accountHolderName: loadedRefundAcc.accountHolderName || user?.fullName || '',
          refundMethod: loadedRefundAcc.refundMethod || 'ORIGINAL_PAYMENT_METHOD',
          bankName: loadedRefundAcc.bankName || '',
          accountNumber: '',
          iban: '',
        });
      } else if (user) {
        setAccountFormData((prev) => ({
          ...prev,
          accountHolderName: user.fullName || '',
        }));
      }

      // Resolve which payable invoice should be pre-loaded into the payment form
      let targetToSelect = null;

      if (queryInvoiceId) {
        const matchingInv = loadedInvoices.find((i) => String(i._id) === String(queryInvoiceId));
        if (matchingInv && ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(matchingInv.status)) {
          targetToSelect = {
            invoice: matchingInv,
            course: matchingInv.course,
            cohort: matchingInv.cohort,
            application: matchingInv.application,
          };
        }
      }

      if (!targetToSelect && queryAppId) {
        const targetApp = loadedApps.find((a) => String(a._id) === String(queryAppId));
        if (targetApp && (targetApp.status === 'Accepted' || targetApp.status === 'Eligible - Payment Pending' || targetApp.eligibilityStatus === 'Eligible')) {
          const existingInv = loadedInvoices.find(
            (inv) => String(inv.application?._id || inv.application) === String(targetApp._id)
          );
          targetToSelect = {
            application: targetApp,
            invoice: existingInv,
            course: targetApp.course,
            cohort: targetApp.cohort,
          };
        }
      }

      // Default: select the first active payable invoice if available
      if (!targetToSelect) {
        const firstPayable = loadedInvoices.find(
          (inv) =>
            ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(inv.status) &&
            (!inv.dueDate || new Date(inv.dueDate) >= new Date())
        );
        if (firstPayable) {
          targetToSelect = {
            invoice: firstPayable,
            course: firstPayable.course,
            cohort: firstPayable.cohort,
            application: firstPayable.application,
          };
        }
      }

      if (!targetToSelect) {
        const firstAcceptedApp = loadedApps.find(
          (a) => a.status === 'Accepted' || a.status === 'Eligible - Payment Pending' || a.eligibilityStatus === 'Eligible'
        );
        if (firstAcceptedApp) {
          const existingInv = loadedInvoices.find(
            (inv) => String(inv.application?._id || inv.application) === String(firstAcceptedApp._id)
          );
          targetToSelect = {
            application: firstAcceptedApp,
            invoice: existingInv,
            course: firstAcceptedApp.course,
            cohort: firstAcceptedApp.cohort,
          };
        }
      }

      if (targetToSelect) {
        openCheckout(targetToSelect);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (isAr ? 'فشل تحميل السجلات المالية.' : 'Failed to load financial records.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [queryAppId, queryInvoiceId]);

  // Handle return from Paymob / Gateway session with polling verification
  useEffect(() => {
    const sessionId = searchParams.get('session_id') || searchParams.get('order_id') || searchParams.get('id');
    const successParam = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');

    let isMounted = true;
    let pollTimeoutId = null;

    if (cancelled === 'true') {
      setPaymentSessionFlow('cancelled');
      setFlowDetails({
        title: isAr ? 'تم إلغاء جلسة الدفع' : 'Payment Session Cancelled',
        message: isAr
          ? 'تم إلغاء عملية الدفع ولم يتم خصم أي مبالغ. يظل حجزك المقبول متاحاً لإعادة المحاولة قبل انتهاء المهلة.'
          : 'Payment session was cancelled. No charges were made. Your reservation remains open to retry before the deadline.',
      });
    } else if (sessionId) {
      setPaymentSessionFlow('processing');
      setFlowDetails({
        title: isAr ? 'جاري التحقق من حالة السداد...' : 'Verifying Payment Settlement...',
        message: isAr
          ? 'جاري تأكيد معاملتك المالية مع بوابة السداد الإلكتروني المعتمدة لوكالة الفضاء المصرية. يرجى الانتظار...'
          : 'Confirming your transaction with the Egyptian Space Agency payment gateway. Please wait a moment...',
      });

      let attempts = 0;
      const maxAttempts = 6;

      const pollStatus = async () => {
        if (!isMounted) return;
        try {
          attempts++;
          setPollAttempt(attempts);
          const res = await paymentService.getSessionStatus(sessionId);
          if (!isMounted) return;

          if (res.isSettled || res.status === 'Paid') {
            setPaymentSessionFlow('confirmed');
            setFlowDetails({
              title: isAr ? 'تم تأكيد الدفع بنجاح!' : 'Payment Confirmed Successfully!',
              message: isAr
                ? 'تم استلام المبلغ وتأكيد التحاقك بالبرنامج التدريبي. تم فتح جميع محتويات التدريب في منصتك.'
                : 'Payment has been settled and verified. Your training program enrollment is finalized!',
              invoice: res.invoice,
              transaction: res.transaction,
              course: res.invoice?.course,
              cohort: res.invoice?.cohort,
              packageType: res.transaction?.packageType || res.invoice?.packageType,
              amount: res.transaction?.amount || res.invoice?.amount,
              currency: res.transaction?.currency || res.invoice?.currency || 'EGP',
              paidAt: res.transaction?.paymentDate || res.invoice?.paidAt || new Date().toISOString(),
            });
            await loadData();
          } else if (res.status === 'Requires_Refund') {
            setPaymentSessionFlow('requires_refund');
            setFlowDetails({
              title: isAr ? 'تنبيه: سداد بعد انتهاء المهلة' : 'Late Payment Detected',
              message: isAr
                ? 'تم استلام الدفعة بعد انتهاء مهلة الـ 72 ساعة المقررة وإلغاء حجز المقعد. تم تسجيل المعاملة للمراجعة المالية من قبل إدارة الأكاديمية.'
                : 'Payment arrived after the 72-hour deadline and reservation expiration. It has been safely recorded for administrative reconciliation.',
              transaction: res.transaction,
              invoice: res.invoice,
            });
            await loadData();
          } else if (res.status === 'Failed') {
            setPaymentSessionFlow('failed');
            setFlowDetails({
              title: isAr ? 'فشلت عملية الدفع' : 'Payment Failed',
              message: isAr
                ? 'تم رفض عملية السداد من جهة إصدار البطاقة. لم يتم خصم أي مبالغ. يمكنك إعادة المحاولة قبل انتهاء المهلة المحددة.'
                : 'Payment was declined by the issuer. No charges were made. You can retry before your reservation deadline.',
              failureReason: res.transaction?.failureReason || (isAr ? 'تم رفض البطاقة من قبل جهة الإصدار.' : 'Card declined by issuer.'),
              transaction: res.transaction,
              invoice: res.invoice,
            });
            await loadData();
          } else if (res.status === 'Cancelled') {
            setPaymentSessionFlow('cancelled');
            setFlowDetails({
              title: isAr ? 'تم إلغاء الجلسة' : 'Session Expired or Cancelled',
              message: isAr
                ? 'انتهت صلاحية جلسة السداد السابقة. يمكنك بدء جلسة دفع جديدة.'
                : 'The previous checkout session has expired. You can initiate a new payment attempt.',
              transaction: res.transaction,
              invoice: res.invoice,
            });
            await loadData();
          } else if (attempts < maxAttempts) {
            pollTimeoutId = setTimeout(pollStatus, 2500);
          } else {
            setPaymentSessionFlow('timeout');
            setFlowDetails({
              title: isAr ? 'المعاملة قيد المعالجة بالبنك' : 'Payment Processing',
              message: isAr
                ? 'تم استلام طلب السداد وجاري معالجته عبر البنك. يرجى تحديث الصفحة بعد قليل لمراجعة حالة الفاتورة.'
                : 'Your payment was received and is processing. Please refresh this page shortly to view the confirmed status.',
              transaction: res.transaction,
              invoice: res.invoice,
            });
            await loadData();
          }
        } catch (err) {
          if (!isMounted) return;
          setPaymentSessionFlow('failed');
          setFlowDetails({
            title: isAr ? 'حالة السداد' : 'Payment Status',
            message:
              err.response?.data?.message ||
              (isAr
                ? 'يرجى مراجعة قائمة الفواتير أدناه للتأكد من حالة السداد.'
                : 'Please check your invoices list below for current settlement status.'),
          });
          await loadData();
        }
      };

      pollStatus();
    }

    return () => {
      isMounted = false;
      if (pollTimeoutId) clearTimeout(pollTimeoutId);
    };
  }, [searchParams]);

  // Authenticated blob loader for viewing submitted payment proof
  useEffect(() => {
    let active = true;
    let url = '';

    if (viewingProofFile?._id) {
      setViewingBlobLoading(true);
      setViewingBlobError('');
      setViewingBlobUrl('');

      paymentService
        .fetchProofFileBlob(viewingProofFile._id)
        .then((blob) => {
          if (!active) return;
          if (!blob.type || !blob.type.startsWith('image/')) {
            throw new Error(isAr ? 'الملف المسترجع ليس صورة صالحة.' : 'Retrieved file is not a valid image format.');
          }
          url = URL.createObjectURL(blob);
          setViewingBlobUrl(url);
        })
        .catch((err) => {
          if (!active) return;
          setViewingBlobError(
            err.response?.data?.message || err.message || (isAr ? 'تعذر تحميل صورة الإيصال.' : 'Unable to render proof image.')
          );
        })
        .finally(() => {
          if (active) setViewingBlobLoading(false);
        });
    } else {
      setViewingBlobUrl('');
      setViewingBlobError('');
      setViewingBlobLoading(false);
    }

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [viewingProofFile, isAr]);

  // Execute Payment Initiation Lifecycle (Initializes Paymob Secure Checkout)
  const handleInitiateAndPay = async () => {
    if (!checkoutTarget) return;
    if (checkoutStep === 'initiating' || checkoutStep === 'processing') return;

    setCheckoutError('');
    setCheckoutStep('initiating');

    try {
      const payload = {
        applicationId:
          checkoutTarget.application?._id ||
          checkoutTarget.invoice?.application?._id ||
          checkoutTarget.invoice?.application,
        invoiceId: checkoutTarget.invoice?._id,
        packageType: selectedPackage,
        method: 'Card',
      };

      // Step 1: Initiate payment session on backend
      const initRes = await paymentService.initiate(payload);
      const data = initRes.data || {};
      const targetIframeUrl = data.iframeUrl;
      const targetPaymentUrl = data.paymentUrl || data.redirectUrl;

      // Safe diagnostic logging in DEVELOPMENT ONLY (Never logs tokens, secrets, or keys)
      if (import.meta.env.DEV) {
        let iframeHostname = '';
        let iframePath = '';
        try {
          if (targetIframeUrl) {
            const parsed = new URL(targetIframeUrl, window.location.origin);
            iframeHostname = parsed.hostname;
            iframePath = parsed.pathname;
          }
        } catch {
          // ignore url parse error
        }

        console.info('[Payment Diagnostic]', {
          provider: data.provider || (data.isMock ? 'DEVELOPMENT_MOCK' : 'PAYMOB'),
          transactionId: data.transaction?.transactionId || data.transactionId || 'N/A',
          invoiceId: payload.invoiceId || data.invoice?._id || 'N/A',
          providerOrderId: data.orderId || data.transaction?.providerOrderId || 'N/A',
          iframeUrlHostname: iframeHostname,
          iframeUrlPath: iframePath,
        });
      }

      if (!targetIframeUrl && !targetPaymentUrl) {
        throw new Error(
          initRes.message ||
            (isAr
              ? 'لم يتم استلام رابط جلسة الدفع من البوابة. يرجى المحاولة مرة أخرى أو التواصل مع إدارة الأكاديمية.'
              : 'Failed to obtain a secure payment gateway session. Please try again or contact administration.')
        );
      }

      // Defensive check before accepting checkout URLs to prevent self-embedding recursion
      const chosenCheckoutUrl = targetIframeUrl || targetPaymentUrl;
      let isInvalidCheckout = false;
      try {
        const parsed = new URL(chosenCheckoutUrl, window.location.origin);
        const isEgsaHost = parsed.hostname === window.location.hostname || parsed.host === window.location.host;
        const isPaymentsPath = parsed.pathname === '/student/payments' || parsed.pathname === '/student/payments/';

        if (isPaymentsPath) {
          isInvalidCheckout = true;
        } else if (!data.isMock && isEgsaHost) {
          isInvalidCheckout = true;
        }
      } catch {
        if (chosenCheckoutUrl?.includes('/student/payments') && !chosenCheckoutUrl?.includes('/mock-checkout')) {
          isInvalidCheckout = true;
        }
      }

      if (isInvalidCheckout) {
        if (import.meta.env.DEV) {
          console.warn('[Payment Guard] Blocked self-embedding payment URL: /student/payments');
        }
        throw new Error(
          isAr
            ? 'بوابة الدفع غير مهيأة بشكل صحيح. يرجى المحاولة لاحقاً.'
            : 'Payment gateway is not configured correctly. Please try again later.'
        );
      }

      setEmbeddedCheckout({
        iframeUrl: targetIframeUrl || targetPaymentUrl,
        paymentUrl: targetPaymentUrl || targetIframeUrl,
        orderId: data.orderId || data.transaction?.providerOrderId,
        transactionId: data.transaction?.transactionId,
        provider: data.provider || (data.isMock ? 'DEVELOPMENT_MOCK' : 'PAYMOB'),
        isMock: data.isMock,
        notice: data.notice,
      });

      setCheckoutStep('embedded_ready');
    } catch (err) {
      setCheckoutStep('failed');
      setCheckoutError(
        err.response?.data?.message ||
          err.message ||
          (isAr
            ? 'تعذر إتمام عملية الدفع. يرجى المحاولة مرة أخرى أو مراجعة إدارة الأكاديمية.'
            : 'Payment transaction failed. Please verify your details or try again.')
      );
    }
  };

  // Save student refund account details
  const handleSaveRefundAccount = async (e) => {
    e.preventDefault();
    setAccountSaving(true);
    setAccountError('');
    try {
      const res = await paymentService.saveRefundAccount(accountFormData);
      setRefundAccount(res.data);
      setShowAccountModal(false);
    } catch (err) {
      setAccountError(
        err.response?.data?.message ||
          (isAr ? 'فشل حفظ تفاصيل حساب الاسترداد.' : 'Failed to save refund account details.')
      );
    } finally {
      setAccountSaving(false);
    }
  };

  // Handle file selection and validation for manual payment proof
  const handleProofFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setProofError(
        isAr
          ? 'صيغة الملف غير مدعومة. يرجى اختيار صورة إيصال بصيغة JPG أو PNG أو WEBP.'
          : 'Invalid file format. Please upload an authentic image (JPEG, PNG, or WEBP).'
      );
      setProofFile(null);
      setProofPreviewUrl('');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProofError(
        isAr
          ? 'حجم الملف يتجاوز الحد الأقصى المسموح به (٥ ميجابايت).'
          : 'File size exceeds the 5MB limit.'
      );
      setProofFile(null);
      setProofPreviewUrl('');
      return;
    }

    setProofError('');
    setProofFile(file);
    setProofPreviewUrl(URL.createObjectURL(file));
  };

  // Submit payment proof to backend
  const handleSubmitProof = async (e) => {
    e.preventDefault();
    const invoiceDoc = checkoutTarget?.invoice;
    if (!invoiceDoc) return;
    if (!proofFile) {
      setProofError(
        isAr ? 'يرجى اختيار صورة إيصال أو لقطة شاشة السداد.' : 'Please select an image file of your payment proof.'
      );
      return;
    }
    if (!senderIdentifier.trim()) {
      setProofError(
        paymentMethod === 'VODAFONE_CASH'
          ? (isAr ? 'يرجى إدخال رقم محفظة فودافون كاش التي تم التحويل منها.' : 'Please enter your sending Vodafone Cash wallet number.')
          : (isAr ? 'يرجى إدخال عنوان إنستاباي (IPA) أو اسم الحساب المحول منه.' : 'Please enter your InstaPay IPA handle or sender account.')
      );
      return;
    }

    setProofSubmitting(true);
    setProofError('');
    setProofSuccess('');

    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      formData.append('paymentMethod', paymentMethod === 'VODAFONE_CASH' ? 'Vodafone_Cash' : 'InstaPay');
      formData.append('senderIdentifier', senderIdentifier.trim());
      if (txReference.trim()) {
        formData.append('transactionReference', txReference.trim());
      }

      await paymentService.submitProof(invoiceDoc._id, formData);
      setProofSuccess(
        isAr
          ? 'تم رفع إيصال السداد بنجاح وهو الآن بانتظار مراجعة وتدقيق الإدارة المالية لتفعيل الالتحاق.'
          : 'Payment proof submitted successfully! It is now pending administrative verification to activate your course enrollment.'
      );
      setProofFile(null);
      setProofPreviewUrl('');
      setForceResubmit(false);
      await loadData();
    } catch (err) {
      setProofError(
        err.response?.data?.message || (isAr ? 'فشل رفع إيصال السداد.' : 'Failed to submit payment proof.')
      );
    } finally {
      setProofSubmitting(false);
    }
  };

  // Submit student refund request
  const handleOpenRefundModal = (inv) => {
    setRefundTargetInvoice(inv);
    setRefundReason('');
    setRefundAmountInput(inv.amount || '');
    setRefundModalError('');
  };

  const handleSubmitRefundRequest = async (e) => {
    e.preventDefault();
    if (!refundTargetInvoice) return;
    setRefundSubmitting(true);
    setRefundModalError('');

    try {
      await paymentService.requestRefund(refundTargetInvoice._id, {
        amount: Number(refundAmountInput) || refundTargetInvoice.amount,
        reason: refundReason,
      });
      setRefundTargetInvoice(null);
      await loadData();
      setActiveTab('refunds');
    } catch (err) {
      setRefundModalError(
        err.response?.data?.message ||
          (isAr ? 'تعذر تقديم طلب الاسترداد.' : 'Failed to submit refund request.')
      );
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Filtered invoices list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'paid') return inv.status === 'Paid';
      if (activeTab === 'pending') {
        return ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(inv.status);
      }
      return true;
    });
  }, [invoices, activeTab]);

  // Payable invoices list
  const payableInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(inv.status) &&
        (!inv.dueDate || new Date(inv.dueDate) >= new Date())
    );
  }, [invoices]);

  // Active target details
  const activeCourse = checkoutTarget?.course || checkoutTarget?.invoice?.course;
  const activeCohort = checkoutTarget?.cohort || checkoutTarget?.application?.cohort || checkoutTarget?.invoice?.cohort;
  const activeInvoice = checkoutTarget?.invoice;
  const hasTransportationSupport = activeCourse && (activeCourse.transportationPrice != null && activeCourse.transportationPrice > 0);

  const activeProof = useMemo(() => {
    if (!activeInvoice?._id) return null;
    return myProofsList.find(
      (p) => String(p.invoice?._id || p.invoice) === String(activeInvoice._id)
    );
  }, [activeInvoice, myProofsList]);

  const displayBasePrice = calculatedPricing?.basePrice ?? activeCourse?.price ?? activeInvoice?.baseAmount ?? activeInvoice?.amount ?? 0;
  const displayTransPrice = calculatedPricing?.transportationPrice ?? activeCourse?.transportationPrice ?? 0;
  const displayTotalDue = calculatedPricing?.totalAmount ?? (selectedPackage === 'WITH_TRANSPORTATION' ? displayBasePrice + displayTransPrice : displayBasePrice);
  const displayCurrency = calculatedPricing?.currency || activeInvoice?.currency || activeCourse?.currency || 'EGP';

  // Authoritative financial summary metrics computed from live application state
  const financialMetrics = useMemo(() => {
    const totalInvoices = invoices.length;
    const payableInvoicesList = invoices.filter(
      (i) =>
        ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(i.status) &&
        (!i.dueDate || new Date(i.dueDate) >= new Date())
    );
    const totalDueAmount = payableInvoicesList.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const paidInvoicesList = invoices.filter((i) => i.status === 'Paid');
    const totalPaidAmount = paidInvoicesList.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const pendingProofs = myProofsList.filter((p) => p.status === 'Pending').length;
    const activeRefunds = myRefunds.filter((r) => r.status === 'Pending' || r.status === 'Under Review').length;

    return {
      totalInvoices,
      payableCount: payableInvoicesList.length,
      outstandingCount: payableInvoicesList.length,
      totalDueAmount,
      outstandingAmount: totalDueAmount,
      paidCount: paidInvoicesList.length,
      totalPaidAmount,
      paidAmount: totalPaidAmount,
      pendingProofs,
      pendingProofsCount: pendingProofs,
      activeRefunds,
      currency: invoices[0]?.currency || 'EGP',
    };
  }, [invoices, myProofsList, myRefunds]);

  if (loading) {
    return (
      <LoadingState
        label={isAr ? 'جاري تحميل السجلات المالية والفواتير…' : 'Loading Course Payments & Invoices…'}
      />
    );
  }

  return (
    <div className={styles.paymentsContainer} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Page Header with Title "Course Payments" */}
      <PageHeader
        title={isAr ? 'مدفوعات الدورات التدريبية' : 'Course Payments'}
        subtitle={
          isAr
            ? 'سداد المصروفات الدراسية، اختيار باقات الانتقال المعتمدة، واستعراض إيصالات وكالة الفضاء المصرية الرسمية.'
            : 'Manage program tuition, select official transportation packages, and review Egyptian Space Agency payment receipts.'
        }
        breadcrumbs={[
          { label: isAr ? 'لوحة التحكم' : 'Portal', to: '/student/dashboard' },
          { label: isAr ? 'مدفوعات الدورات التدريبية' : 'Course Payments' },
        ]}
      />

      {/* 2. Gateway Return Feedback & Verification States */}
      {paymentSessionFlow && (
        <div className="card border-0 shadow-sm mb-4 overflow-hidden">
          {paymentSessionFlow === 'processing' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-info">
              <div className="spinner-border text-primary mb-3" style={{ width: '3.5rem', height: '3.5rem' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h4 className="fw-bold text-dark mb-2">
                {flowDetails?.title || (isAr ? 'جاري التحقق من عملية السداد...' : 'Verifying Payment Settlement...')}
              </h4>
              <p className="text-muted small mb-3 mx-auto" style={{ maxWidth: '540px' }}>
                {flowDetails?.message}
              </p>
              <div className="badge bg-info-subtle text-info p-2 px-3 small">
                <i className="fa-solid fa-arrows-rotate fa-spin me-2"></i>
                {isAr ? `فحص حالة السداد مع البوابة (المحاولة ${pollAttempt} من ٦)…` : `Checking payment gateway confirmation (Attempt ${pollAttempt} of 6)…`}
              </div>
            </div>
          )}

          {paymentSessionFlow === 'confirmed' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-success">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3"
                style={{ width: '64px', height: '64px' }}
              >
                <i className="fa-solid fa-circle-check fs-2"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <div className="d-flex justify-content-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4"
                  onClick={() => {
                    dismissFlowState();
                    setReceiptData({
                      invoice: flowDetails.invoice,
                      transaction: flowDetails.transaction,
                      course: flowDetails.course,
                      cohort: flowDetails.cohort,
                      packageType: flowDetails.packageType,
                      amount: flowDetails.amount,
                      currency: flowDetails.currency,
                      paidAt: flowDetails.paidAt,
                    });
                  }}
                >
                  <i className="fa-solid fa-receipt me-1"></i> {isAr ? 'عرض الإيصال الرسمي' : 'View Official Receipt'}
                </button>
                <Link to="/student/training" className="btn btn-outline-primary btn-sm px-4">
                  <i className="fa-solid fa-graduation-cap me-1"></i> {isAr ? 'بدء التدريب' : 'Go to Training'}
                </Link>
              </div>
            </div>
          )}

          {paymentSessionFlow === 'failed' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-danger">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger mb-3"
                style={{ width: '64px', height: '64px' }}
              >
                <i className="fa-solid fa-circle-xmark fs-2"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-danger small mb-3">{flowDetails?.failureReason}</p>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <button type="button" className="btn btn-primary btn-sm px-4" onClick={dismissFlowState}>
                {isAr ? 'العودة لنموذج السداد' : 'Return to Payment'}
              </button>
            </div>
          )}

          {paymentSessionFlow === 'cancelled' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-warning">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning mb-3"
                style={{ width: '64px', height: '64px' }}
              >
                <i className="fa-solid fa-clock-rotate-left fs-2"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <button type="button" className="btn btn-primary btn-sm px-4" onClick={dismissFlowState}>
                {isAr ? 'إعادة المحاولة' : 'Try Again'}
              </button>
            </div>
          )}

          {paymentSessionFlow === 'requires_refund' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-warning">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning mb-3"
                style={{ width: '64px', height: '64px' }}
              >
                <i className="fa-solid fa-triangle-exclamation fs-2"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <button type="button" className="btn btn-outline-secondary btn-sm px-4" onClick={dismissFlowState}>
                {isAr ? 'إغلاق التنبيه' : 'Dismiss'}
              </button>
            </div>
          )}

          {paymentSessionFlow === 'timeout' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-secondary">
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <button type="button" className="btn btn-primary btn-sm px-4" onClick={dismissFlowState}>
                {isAr ? 'حسناً، تم الاطلاع' : 'OK, Understood'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. FINANCIAL SUMMARY METRICS GRID */}
      <div className={styles.metricsGrid}>
        {/* Metric 1: Outstanding Tuition */}
        <div className={styles.metricCard}>
          <div className={`${styles.metricIcon} ${financialMetrics.outstandingCount > 0 ? styles.metricIconWarning : styles.metricIconNavy}`}>
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div className={styles.metricContent}>
            <span className={styles.metricLabel}>
              {isAr ? 'مصروفات مستحقة السداد' : 'Outstanding Tuition'}
            </span>
            <div className={styles.metricValue}>
              {formatAmount(financialMetrics.outstandingAmount)} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>EGP</span>
            </div>
            <span className={styles.metricSubtext}>
              {financialMetrics.outstandingCount === 0
                ? (isAr ? 'لا توجد مستحقات معلقة' : 'No overdue tuition')
                : (isAr ? `${financialMetrics.outstandingCount} فاتورة مستحقة` : `${financialMetrics.outstandingCount} invoice(s) due`)}
            </span>
          </div>
        </div>

        {/* Metric 2: Settled Tuition Receipts */}
        <div className={styles.metricCard}>
          <div className={`${styles.metricIcon} ${styles.metricIconSuccess}`}>
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className={styles.metricContent}>
            <span className={styles.metricLabel}>
              {isAr ? 'إجمالي المسدد والمؤكد' : 'Settled Tuition'}
            </span>
            <div className={styles.metricValue}>
              {formatAmount(financialMetrics.paidAmount)} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>EGP</span>
            </div>
            <span className={styles.metricSubtext}>
              {isAr ? `${financialMetrics.paidCount} إيصال رسمي معتمد` : `${financialMetrics.paidCount} official receipt(s)`}
            </span>
          </div>
        </div>

        {/* Metric 3: Manual Proofs in Queue */}
        <div className={styles.metricCard}>
          <div className={`${styles.metricIcon} ${styles.metricIconGold}`}>
            <i className="fa-solid fa-file-invoice-dollar"></i>
          </div>
          <div className={styles.metricContent}>
            <span className={styles.metricLabel}>
              {isAr ? 'إيصالات قيد المراجعة' : 'Verification Queue'}
            </span>
            <div className={styles.metricValue}>
              {financialMetrics.pendingProofsCount ?? 0}
            </div>
            <span className={styles.metricSubtext}>
              {isAr ? 'بانتظار تدقيق المالية' : 'Pending finance review'}
            </span>
          </div>
        </div>

        {/* Metric 4: Refund Account Destination */}
        <div className={styles.metricCard}>
          <div className={`${styles.metricIcon} ${styles.metricIconNavy}`}>
            <i className="fa-solid fa-building-columns"></i>
          </div>
          <div className={styles.metricContent} style={{ flexGrow: 1 }}>
            <div className="d-flex justify-content-between align-items-center">
              <span className={styles.metricLabel}>
                {isAr ? 'حساب الاسترداد' : 'Refund Account'}
              </span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none"
                style={{ fontSize: '0.75rem', color: 'var(--egsa-cosmos-blue)' }}
                onClick={() => setShowAccountModal(true)}
              >
                {isAr ? 'تعديل' : 'Edit'}
              </button>
            </div>
            <div className={styles.metricValue} style={{ fontSize: '1rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {refundAccount?.refundMethod === 'BANK_TRANSFER'
                ? (refundAccount.bankName || 'Bank Transfer')
                : (isAr ? 'نفس البطاقة' : 'Original Card')}
            </div>
            <span className={styles.metricSubtext} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {refundAccount?.accountHolderName || user?.fullName || 'EGSA Trainee'}
            </span>
          </div>
        </div>
      </div>

      {/* Official EGSA Refund Policy Banner */}
      <div className="alert alert-info border-0 shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 mb-4 rounded">
        <div className="d-flex align-items-center gap-3">
          <i className="fa-solid fa-shield-halved fs-4 text-primary flex-shrink-0"></i>
          <div>
            <strong className="text-dark d-block">
              {isAr ? 'سياسة الاسترداد الرسمية لوكالة الفضاء المصرية' : 'Official EGSA Space Academy Refund Policy'}
            </strong>
            <small className="text-muted">
              {isAr
                ? 'تخضع جميع المعاملات لرقابة الإدارة المالية وفقاً للوائح البنك المركزي والضوابط الأكاديمية.'
                : 'All transactions adhere to Central Bank regulations and official EGSA Academy financial policies.'}
            </small>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm px-3"
          onClick={() => setShowPolicyModal(true)}
        >
          <i className="fa-solid fa-book-open me-1"></i>
          {isAr ? 'قراءة السياسة المالية المعتمدة' : 'Read Refund Policy'}
        </button>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {/* 4. ACTIVE COURSE PAYMENT FORM & CUSTOM CARD CHECKOUT INTERFACE */}
      {checkoutTarget && !['processing', 'confirmed'].includes(paymentSessionFlow) ? (
        <div className="card border-0 shadow-sm mb-5 border-top border-4 border-primary">
          <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary-subtle text-primary p-2">
                <i className="fa-solid fa-credit-card fa-lg"></i>
              </span>
              <div>
                <h5 className="fw-bold text-dark mb-0">
                  {isAr ? 'نموذج سداد المصروفات الدراسية' : 'Course Tuition Payment Form'}
                </h5>
                <small className="text-muted">
                  {isAr ? 'بوابة سداد مشفرة وفقاً لمعايير وكالة الفضاء المصرية والبنك المركزي' : 'Secure Card Payment Interface — Central Bank of Egypt Regulated'}
                </small>
              </div>
            </div>

            {payableInvoices.length > 1 && (
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">{isAr ? 'اختر الفاتورة:' : 'Select Invoice:'}</span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={activeInvoice?._id || ''}
                  onChange={(e) => {
                    const chosen = invoices.find((i) => i._id === e.target.value);
                    if (chosen) openCheckout({ invoice: chosen, course: chosen.course, cohort: chosen.cohort, application: chosen.application });
                  }}
                >
                  {payableInvoices.map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      {inv.course?.title} ({inv.invoiceNumber || 'INV'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="card-body p-4">
            {checkoutError && (
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-4">
                <i className="fa-solid fa-triangle-exclamation fs-5 flex-shrink-0"></i>
                <div>
                  <strong>{isAr ? 'تنبيه في الدفع: ' : 'Payment Error: '}</strong>
                  <span>{checkoutError}</span>
                </div>
              </div>
            )}

            {/* If embedded payment session is ready, display the secure card interface container */}
            {embeddedCheckout && checkoutStep === 'embedded_ready' ? (
              <div className="mb-4">
                <div className="alert alert-success d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div>
                    <i className="fa-solid fa-lock me-2"></i>
                    <strong>{isAr ? 'جلسة دفع آمنة جاهزة' : 'Secure Payment Session Ready'}</strong>
                    <span className="ms-2 small text-muted">
                      ({isAr ? 'المرجع:' : 'Order Ref:'} {embeddedCheckout.orderId})
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setEmbeddedCheckout(null)}
                  >
                    <i className="fa-solid fa-arrow-left me-1"></i> {isAr ? 'تغيير الباقة' : 'Back to Options'}
                  </button>
                </div>

                <div className="card border border-2 border-primary shadow-sm overflow-hidden rounded">
                  <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-2 px-3">
                    <span className="small d-flex align-items-center gap-2">
                      <i className={`fa-solid ${embeddedCheckout.isMock ? 'fa-flask text-warning' : 'fa-shield-halved text-success'}`}></i>
                      <span>
                        {embeddedCheckout.isMock
                          ? (isAr ? 'بيئة سداد تجريبية (محاكاة محلية)' : 'Development Sandbox Card Simulation')
                          : (isAr ? 'نافذة سداد البطاقة المشفرة (PCI-DSS)' : 'PCI-DSS Compliant Secure Card Checkout')}
                      </span>
                    </span>
                    <a
                      href={embeddedCheckout.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-light py-0 px-2 small"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>
                      {isAr ? 'فتح في نافذة كاملة' : 'Open in New Tab'}
                    </a>
                  </div>

                  <div className="card-body p-0 bg-white" style={{ minHeight: '580px' }}>
                    {(() => {
                      let isSelfEmbed = false;
                      try {
                        const parsed = new URL(embeddedCheckout.iframeUrl, window.location.origin);
                        const isEgsaHost = parsed.hostname === window.location.hostname || parsed.host === window.location.host;
                        const isPaymentsPath = parsed.pathname === '/student/payments' || parsed.pathname === '/student/payments/';

                        if (isPaymentsPath) {
                          isSelfEmbed = true;
                        } else if (!embeddedCheckout.isMock && isEgsaHost) {
                          isSelfEmbed = true;
                        }
                      } catch {
                        if (embeddedCheckout.iframeUrl?.includes('/student/payments') && !embeddedCheckout.iframeUrl?.includes('/mock-checkout')) {
                          isSelfEmbed = true;
                        }
                      }

                      if (isSelfEmbed) {
                        return (
                          <div className="p-5 text-center">
                            <div className="alert alert-danger d-inline-block text-start p-4 shadow-sm" role="alert" style={{ maxWidth: '520px' }}>
                              <h6 className="alert-heading fw-bold d-flex align-items-center gap-2 text-danger">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                {isAr ? 'تنبيه أمان البوابة' : 'Gateway Configuration Guard'}
                              </h6>
                              <p className="mb-0 text-dark small">
                                {isAr
                                  ? 'بوابة الدفع غير مهيأة بشكل صحيح. يرجى المحاولة لاحقاً.'
                                  : 'Payment gateway is not configured correctly. Please try again later.'}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <iframe
                          src={embeddedCheckout.iframeUrl}
                          title="EGSA Secure Card Payment Form"
                          width="100%"
                          height="600"
                          frameBorder="0"
                          className="w-100"
                          style={{ border: 'none', display: 'block' }}
                        />
                      );
                    })()}
                  </div>

                  <div className="card-footer bg-light py-2 px-3 small text-muted d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span>
                      <i className="fa-solid fa-building-columns me-1 text-primary"></i>
                      {embeddedCheckout.isMock
                        ? (isAr ? 'محاكاة دفع محلية لأغراض التطوير والاختبار' : 'Local Sandbox Mock Payment Provider')
                        : (isAr ? 'معالجة مالية معتمدة وفقاً للبنك المركزي المصري' : 'Egyptian Space Agency — Licensed Egyptian Payment Gateway')}
                    </span>
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-muted"
                      onClick={() => setEmbeddedCheckout(null)}
                    >
                      {isAr ? 'إلغاء والعودة' : 'Cancel Transaction'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Course Details, Package Options & Review */
              <div className={styles.workspaceGrid}>
                {/* Left Column: Course & Package Selection */}
                <div className={styles.workspaceMain}>
                  {/* Course Details Card */}
                  <div className="p-3 bg-light rounded border mb-1">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-light text-primary border">
                        {activeInvoice?.invoiceNumber || 'EGSA-TUITION-INVOICE'}
                      </span>
                      <StatusBadge status={activeInvoice?.status || 'Pending'} />
                    </div>
                    <h4 className="fw-bold text-dark mb-1">{activeCourse?.title || 'Egyptian Space Academy Training Program'}</h4>
                    {activeCohort && (
                      <div className="text-muted small mb-2">
                        <i className="fa-solid fa-users me-1 text-primary"></i>
                        <span>{isAr ? 'الدفعة التدريبية: ' : 'Cohort: '}</span>
                        <strong>{activeCohort.name || activeCohort}</strong>
                      </div>
                    )}
                    {activeInvoice?.dueDate && (
                      <div className="text-muted small">
                        <i className="fa-regular fa-clock me-1 text-warning"></i>
                        <span>{isAr ? 'آخر موعد للسداد: ' : 'Payment Deadline: '}</span>
                        <strong className="text-dark">{formatDateTime(activeInvoice.dueDate)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Package Options Selection */}
                  <div className="mb-2">
                    <label className="form-label fw-bold text-dark small text-uppercase mb-2">
                      {isAr ? '١. اختيار باقة التدريب والخدمات اللوجستية:' : '1. Select Training & Logistics Package:'}
                    </label>
                    <div className={styles.packageSelector}>
                      {/* Option 1: Course Tuition Only */}
                      <label
                        className={`${styles.packageOption} ${
                          selectedPackage === 'WITHOUT_TRANSPORTATION' ? styles.packageOptionActive : ''
                        }`}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <input
                            type="radio"
                            name="packageType"
                            value="WITHOUT_TRANSPORTATION"
                            checked={selectedPackage === 'WITHOUT_TRANSPORTATION'}
                            onChange={() => handlePackageChange('WITHOUT_TRANSPORTATION')}
                            disabled={checkoutStep === 'initiating' || checkoutStep === 'processing'}
                            className="form-check-input mt-0"
                          />
                          <div>
                            <div className={styles.packageTitle}>
                              {isAr ? 'الدورة التدريبية فقط (بدون انتقالات)' : 'Standard Package: Course Tuition Only'}
                            </div>
                            <div className={styles.packageDescription}>
                              {isAr
                                ? 'حضور كافة المحاضرات، التدريب العملي في المعامل، والمواد التدريبية الرسمية.'
                                : 'Full access to academic lectures, specialized labs, materials, and accreditation.'}
                            </div>
                          </div>
                        </div>
                        <span className={styles.packagePrice}>
                          {formatAmount(displayBasePrice)} {displayCurrency}
                        </span>
                      </label>

                      {/* Option 2: Course Tuition + Transportation (if available) */}
                      {hasTransportationSupport ? (
                        <label
                          className={`${styles.packageOption} ${
                            selectedPackage === 'WITH_TRANSPORTATION' ? styles.packageOptionActive : ''
                          }`}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <input
                              type="radio"
                              name="packageType"
                              value="WITH_TRANSPORTATION"
                              checked={selectedPackage === 'WITH_TRANSPORTATION'}
                              onChange={() => handlePackageChange('WITH_TRANSPORTATION')}
                              disabled={checkoutStep === 'initiating' || checkoutStep === 'processing'}
                              className="form-check-input mt-0"
                            />
                            <div>
                              <div className={styles.packageTitle}>
                                {isAr ? 'الدورة التدريبية + حافلات الانتقال اليومية' : 'Full Package: Course + Transportation'}
                              </div>
                              <div className={styles.packageDescription}>
                                {isAr
                                  ? 'يشمل الانتقال اليومي بحافلات وكالة الفضاء من نقاط التجمع المعتمدة إلى مقر الوكالة.'
                                  : 'Includes scheduled daily EGSA shuttle service from designated assembly points in Cairo.'}
                              </div>
                            </div>
                          </div>
                          <span className={styles.packagePrice}>
                            {formatAmount(displayBasePrice + displayTransPrice)} {displayCurrency}
                          </span>
                        </label>
                      ) : null}
                    </div>
                  </div>

                  {/* 2. Payment Method Selection */}
                  <div className="mb-2">
                    <label className="form-label fw-bold text-dark small text-uppercase mb-2">
                      {isAr ? '٢. طريقة السداد المعتمدة:' : '2. Select Payment Method:'}
                    </label>
                    <div className={styles.methodGrid}>
                      <button
                        type="button"
                        className={`${styles.methodBtn} ${paymentMethod === 'CARD' ? styles.methodBtnActiveCard : ''}`}
                        onClick={() => {
                          setPaymentMethod('CARD');
                          setForceResubmit(false);
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between w-100 mb-1">
                          <i className="fa-solid fa-credit-card fs-5 text-primary"></i>
                          {paymentMethod === 'CARD' && <i className="fa-solid fa-circle-check text-primary"></i>}
                        </div>
                        <strong className="small">{isAr ? 'بطاقة بنكية' : 'Credit / Debit Card'}</strong>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {isAr ? 'بوابة إلكترونية فورية' : 'Paymob Online Gateway'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.methodBtn} ${paymentMethod === 'VODAFONE_CASH' ? styles.methodBtnActiveVodafone : ''}`}
                        onClick={() => setPaymentMethod('VODAFONE_CASH')}
                      >
                        <div className="d-flex align-items-center justify-content-between w-100 mb-1">
                          <i className="fa-solid fa-mobile-screen fs-5 text-danger"></i>
                          {paymentMethod === 'VODAFONE_CASH' && <i className="fa-solid fa-circle-check text-danger"></i>}
                        </div>
                        <strong className="small">{isAr ? 'فودافون كاش' : 'Vodafone Cash'}</strong>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {isAr ? 'تحويل محفظة ومراجعة' : 'Wallet Transfer + Proof'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.methodBtn} ${paymentMethod === 'INSTAPAY' ? styles.methodBtnActiveInstapay : ''}`}
                        onClick={() => setPaymentMethod('INSTAPAY')}
                      >
                        <div className="d-flex align-items-center justify-content-between w-100 mb-1">
                          <i className="fa-solid fa-bolt fs-5 text-success"></i>
                          {paymentMethod === 'INSTAPAY' && <i className="fa-solid fa-circle-check text-success"></i>}
                        </div>
                        <strong className="small">{isAr ? 'إنستاباي' : 'InstaPay'}</strong>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                          {isAr ? 'تحويل لحظي ومراجعة' : 'Instant IPA + Proof'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Manual Payment Instructions & Receiving Account Details */}
                  {paymentMethod !== 'CARD' && (
                    <div className="mb-4">
                      <div className="p-3 bg-light border rounded mb-3">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <i className={`fa-solid ${paymentMethod === 'VODAFONE_CASH' ? 'fa-mobile-screen text-danger' : 'fa-bolt text-success'} fs-5`}></i>
                          <h6 className="fw-bold mb-0 text-dark">
                            {paymentMethod === 'VODAFONE_CASH'
                              ? (isAr ? 'بيانات التحويل الرسمي: محفظة فودافون كاش' : 'Official Vodafone Cash Receiving Details')
                              : (isAr ? 'بيانات التحويل الرسمي: حساب إنستاباي (InstaPay)' : 'Official InstaPay Receiving Details')}
                          </h6>
                        </div>

                        <div className="p-3 bg-white border rounded mb-2">
                          {paymentMethod === 'VODAFONE_CASH' ? (
                            <>
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="small text-muted">{isAr ? 'رقم المحفظة المعتمد للتحويل:' : 'Official Wallet Number:'}</span>
                                <strong className="fs-6 text-danger text-monospace">
                                  {manualSettings?.vodafoneCash?.receivingNumber || '01000000000'}
                                </strong>
                              </div>
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="small text-muted">{isAr ? 'اسم المستلم:' : 'Account Holder:'}</span>
                                <strong className="small text-dark">
                                  {manualSettings?.vodafoneCash?.accountName || 'Egyptian Space Agency'}
                                </strong>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="small text-muted">{isAr ? 'عنوان الدفع اللحظي (IPA):' : 'InstaPay Address (IPA):'}</span>
                                <strong className="fs-6 text-success text-monospace">
                                  {manualSettings?.instaPay?.receivingAddress || 'egsa@instapay'}
                                </strong>
                              </div>
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="small text-muted">{isAr ? 'اسم الحساب المستلم:' : 'Account Holder:'}</span>
                                <strong className="small text-dark">
                                  {manualSettings?.instaPay?.accountName || 'Egyptian Space Agency'}
                                </strong>
                              </div>
                            </>
                          )}
                        </div>

                        <p className="small text-muted mb-0">
                          <i className="fa-solid fa-circle-info me-1 text-primary"></i>
                          {paymentMethod === 'VODAFONE_CASH'
                            ? (manualSettings?.vodafoneCash?.instructions ||
                              (isAr
                                ? 'يرجى تحويل إجمالي المصروفات من محفظتك إلى رقم المحفظة أعلاه، ثم التقاط لقطة شاشة للإيصال ورفعها أدناه.'
                                : 'Transfer the total amount from your wallet to the number above, then upload a screenshot of the confirmation below.'))
                            : (manualSettings?.instaPay?.instructions ||
                              (isAr
                                ? 'يرجى تحويل إجمالي المصروفات عبر تطبيق إنستاباي إلى العنوان أعلاه، ثم التقاط لقطة شاشة لعملية التحويل الناجحة ورفعها أدناه.'
                                : 'Transfer the total amount via InstaPay to the address above, then upload a screenshot of the successful transfer below.'))}
                        </p>
                      </div>

                      {/* Statutory Disclaimer & Format Limits */}
                      <div className="alert alert-warning border-0 small p-3 mb-3 d-flex align-items-start gap-2">
                        <i className="fa-solid fa-triangle-exclamation fs-5 text-warning flex-shrink-0 mt-1"></i>
                        <div>
                          <strong>{isAr ? 'تنبيه نظامي هام: ' : 'Statutory Notice: '}</strong>
                          <span>
                            {isAr
                              ? 'رفع لقطة شاشة أو إيصال السداد لا يُعد سداداً معتمداً ولا يمنح حق الالتحاق بالدورة فوراً. يتم تدقيق الإيصال وتأكيد تفعيل الالتحاق من قِبل الإدارة المالية للأكاديمية.'
                              : 'Uploading payment proof does not constitute verified payment and does not grant course access immediately. Enrollment is activated only upon review and formal approval by Academy Finance.'}
                          </span>
                          <div className="mt-1 text-muted">
                            <i className="fa-solid fa-file-image me-1"></i>
                            {isAr ? 'الصيغ المقبولة: JPG, PNG, WEBP (الحد الأقصى للحجم ٥ ميجابايت).' : 'Accepted formats: JPEG, PNG, WEBP (Maximum size: 5MB).'}
                          </div>
                        </div>
                      </div>

                      {/* Active Proof Status Banner or Upload Form */}
                      {activeProof && !forceResubmit ? (
                        <div className="p-3 bg-white border rounded">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <span className="small text-muted">{isAr ? 'حالة إيصال السداد الحالي:' : 'Current Submission Status:'}</span>
                            <span
                              className={`badge ${
                                activeProof.status === 'Approved'
                                  ? 'bg-success'
                                  : activeProof.status === 'Rejected'
                                  ? 'bg-danger'
                                  : 'bg-warning text-dark'
                              }`}
                            >
                              {activeProof.status === 'Approved'
                                ? (isAr ? 'معتمد ومؤكد' : 'Approved')
                                : activeProof.status === 'Rejected'
                                ? (isAr ? 'مرفوض' : 'Rejected')
                                : (isAr ? 'بانتظار المراجعة المالية' : 'Pending Review')}
                            </span>
                          </div>

                          <div className="p-2 bg-light rounded small mb-2">
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">{isAr ? 'طريقة التحويل:' : 'Method:'}</span>
                              <strong className="text-dark">{activeProof.paymentMethod?.replace('_', ' ')}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">{isAr ? 'بيانات المرسل:' : 'Sender ID:'}</span>
                              <strong className="text-dark">{activeProof.senderIdentifier}</strong>
                            </div>
                            {activeProof.transactionReference && (
                              <div className="d-flex justify-content-between mb-1">
                                <span className="text-muted">{isAr ? 'رقم المعاملة:' : 'Transaction Ref:'}</span>
                                <strong className="text-dark">{activeProof.transactionReference}</strong>
                              </div>
                            )}
                            <div className="d-flex justify-content-between">
                              <span className="text-muted">{isAr ? 'تاريخ الرفع:' : 'Submitted At:'}</span>
                              <span className="text-dark">{formatDateTime(activeProof.createdAt)}</span>
                            </div>
                          </div>

                          {activeProof.status === 'Pending' && (
                            <div className="alert alert-info border-0 p-2 small mb-2 d-flex align-items-center gap-2">
                              <i className="fa-solid fa-hourglass-half text-info"></i>
                              <span>
                                {isAr
                                  ? 'إيصالك مسجل بنجاح وهو الآن قيد التدقيق لدى الإدارة المالية. سيتم تفعيل حسابك بمجرد المراجعة.'
                                  : 'Your proof is securely queued for administrative verification. Your enrollment will activate automatically upon approval.'}
                              </span>
                            </div>
                          )}

                          {activeProof.status === 'Rejected' && (
                            <div className="alert alert-danger border-0 p-3 small mb-2">
                              <div className="fw-bold mb-1 d-flex align-items-center gap-2 text-danger">
                                <i className="fa-solid fa-circle-xmark"></i>
                                {isAr ? 'تم رفض إيصال السداد للسبب التالي:' : 'Proof was rejected for the following reason:'}
                              </div>
                              <p className="mb-2 text-dark bg-white p-2 rounded border">
                                {activeProof.rejectionReason || (isAr ? 'بيانات التحويل غير واضحة أو غير مطابقة.' : 'Proof unreadable or amount mismatch.')}
                              </p>
                              <button
                                type="button"
                                className="btn btn-warning btn-sm fw-bold w-100"
                                onClick={() => setForceResubmit(true)}
                              >
                                <i className="fa-solid fa-arrow-rotate-right me-1"></i>
                                {isAr ? 'رفع إيصال مصحح جديد' : 'Resubmit Corrected Proof'}
                              </button>
                            </div>
                          )}

                          {activeProof.status === 'Approved' && (
                            <div className="alert alert-success border-0 p-3 small mb-2">
                              <div className="fw-bold mb-1 d-flex align-items-center gap-2 text-success">
                                <i className="fa-solid fa-circle-check"></i>
                                {isAr ? 'تم تأكيد السداد وتفعيل التحاقك بالدورة بنجاح!' : 'Payment verified! Enrollment is active.'}
                              </div>
                              <Link to="/student/training" className="btn btn-success btn-sm mt-2 w-100">
                                <i className="fa-solid fa-graduation-cap me-1"></i>
                                {isAr ? 'الانتقال إلى تدريبي' : 'Go to My Training'}
                              </Link>
                            </div>
                          )}

                          <div className="d-flex gap-2 mt-2">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm w-100"
                              onClick={() => setViewingProofFile(activeProof)}
                            >
                              <i className="fa-solid fa-image me-1"></i>
                              {isAr ? 'معاينة الإيصال المرفوع' : 'View Uploaded Proof'}
                            </button>
                            {activeProof.status === 'Pending' && (
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => setForceResubmit(true)}
                                title={isAr ? 'تعديل الإيصال' : 'Replace Proof'}
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Proof Upload Form */
                        <form onSubmit={handleSubmitProof} className="p-3 bg-white border rounded">
                          <h6 className="fw-bold text-dark mb-3">
                            <i className="fa-solid fa-cloud-arrow-up me-1 text-primary"></i>
                            {forceResubmit
                              ? (isAr ? 'إعادة رفع إيصال السداد المصحح' : 'Resubmit Corrected Proof')
                              : (isAr ? 'رفع إيصال سداد المصروفات' : 'Submit Payment Proof')}
                          </h6>

                          {proofError && <div className="alert alert-danger small p-2 mb-3">{proofError}</div>}
                          {proofSuccess && <div className="alert alert-success small p-2 mb-3">{proofSuccess}</div>}

                          <div className="mb-3">
                            <label className="form-label small fw-bold">
                              {paymentMethod === 'VODAFONE_CASH'
                                ? (isAr ? 'رقم محفظة فودافون كاش التي قمت بالتحويل منها *' : 'Sender Vodafone Cash Wallet Number *')
                                : (isAr ? 'عنوان إنستاباي (IPA) أو اسم الحساب المحول منه *' : 'Sender InstaPay Address (IPA) or Name *')}
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              required
                              placeholder={
                                paymentMethod === 'VODAFONE_CASH'
                                  ? (isAr ? 'مثال: 01012345678' : 'e.g. 01012345678')
                                  : (isAr ? 'مثال: username@instapay' : 'e.g. username@instapay')
                              }
                              value={senderIdentifier}
                              onChange={(e) => setSenderIdentifier(e.target.value)}
                            />
                          </div>

                          <div className="mb-3">
                            <label className="form-label small fw-bold">
                              {isAr ? 'رقم المعاملة / كود العملية (اختياري)' : 'Transaction Reference / Op ID (Optional)'}
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder={isAr ? 'مثال: TXN-984321' : 'e.g. TXN-984321'}
                              value={txReference}
                              onChange={(e) => setTxReference(e.target.value)}
                            />
                          </div>

                          <div className="mb-3">
                            <label className="form-label small fw-bold">
                              {isAr ? 'صورة إيصال التحويل (JPG, PNG, WEBP بحد أقصى ٥ ميجابايت) *' : 'Payment Receipt Image (JPG, PNG, WEBP max 5MB) *'}
                            </label>
                            <input
                              type="file"
                              className="form-control form-control-sm"
                              accept="image/jpeg,image/png,image/webp"
                              required={!proofFile}
                              onChange={handleProofFileChange}
                            />
                          </div>

                          {proofPreviewUrl && (
                            <div className="mb-3 text-center p-2 bg-light border rounded">
                              <span className="small text-muted d-block mb-1">{isAr ? 'معاينة الصورة المحددة:' : 'Selected Image Preview:'}</span>
                              <img
                                src={proofPreviewUrl}
                                alt="Proof Preview"
                                style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
                                className="rounded border shadow-sm"
                              />
                            </div>
                          )}

                          <div className="d-flex gap-2">
                            {forceResubmit && activeProof && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => setForceResubmit(false)}
                              >
                                {isAr ? 'إلغاء' : 'Cancel'}
                              </button>
                            )}
                            <button
                              type="submit"
                              className="btn btn-primary btn-sm flex-grow-1 fw-bold"
                              disabled={proofSubmitting}
                            >
                              {proofSubmitting ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1"></span>
                                  {isAr ? 'جاري رفع وتشفير الإيصال…' : 'Uploading Secure Proof…'}
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-cloud-arrow-up me-1"></i>
                                  {isAr ? 'إرسال إيصال السداد للمراجعة المالية' : 'Submit Proof for Review'}
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Gateway Security & Terms */}
                  <div className="p-3 bg-light border rounded small d-flex align-items-center justify-content-between text-muted">
                    <span className="d-flex align-items-center gap-2">
                      <i className="fa-solid fa-lock text-success"></i>
                      <span>{isAr ? 'معاملات آمنة ومشفرة وفقاً لمعايير وكالة الفضاء المصرية' : 'PCI-DSS & Secure Financial Verification — Egyptian Space Agency'}</span>
                    </span>
                    <span className="badge bg-primary-subtle text-primary small">
                      EGSA SECURE CHECKOUT
                    </span>
                  </div>
                </div>

                {/* Right Column: Authoritative Financial Summary & Pay Action */}
                <div className={styles.workspaceSide}>
                  <div className={styles.portalCard}>
                    <div className={styles.portalCardHeader}>
                      <h6 className={styles.portalCardTitle}>
                        <i className="fa-solid fa-file-invoice-dollar text-primary"></i>
                        <span>{isAr ? 'ملخص الفاتورة والسداد' : 'Payment Summary'}</span>
                      </h6>
                      <span className="badge bg-light text-primary border" style={{ fontSize: '0.72rem' }}>
                        {activeInvoice?.invoiceNumber || 'INVOICE'}
                      </span>
                    </div>

                    <div className={styles.portalCardBody}>
                      <div className={styles.summaryRow}>
                        <span>{isAr ? 'المصروفات الأساسية:' : 'Base Course Tuition:'}</span>
                        <strong className="text-dark">
                          {formatAmount(displayBasePrice)} {displayCurrency}
                        </strong>
                      </div>

                      {selectedPackage === 'WITH_TRANSPORTATION' && (
                        <div className={styles.summaryRow}>
                          <span>{isAr ? 'رسوم الانتقالات المعتمدة:' : 'Transportation Option:'}</span>
                          <strong className="text-dark">
                            +{formatAmount(displayTransPrice)} {displayCurrency}
                          </strong>
                        </div>
                      )}

                      <div className={styles.summaryRow}>
                        <span>{isAr ? 'الباقة المختارة:' : 'Selected Package:'}</span>
                        <span className="text-primary fw-medium">
                          {selectedPackage === 'WITH_TRANSPORTATION'
                            ? (isAr ? 'الدورة + الانتقالات' : 'Course + Transport')
                            : (isAr ? 'الدورة فقط' : 'Course Only')}
                        </span>
                      </div>

                      <div className={styles.summaryRow}>
                        <span>{isAr ? 'طريقة السداد:' : 'Payment Method:'}</span>
                        <span className="badge bg-light text-dark border">
                          {paymentMethod === 'CARD'
                            ? (isAr ? 'بطاقة إلكترونية (Paymob)' : 'Online Card (Paymob)')
                            : paymentMethod === 'VODAFONE_CASH'
                            ? (isAr ? 'فودافون كاش' : 'Vodafone Cash')
                            : (isAr ? 'إنستاباي' : 'InstaPay')}
                        </span>
                      </div>

                      <div className={styles.summaryRow}>
                        <span>{isAr ? 'العملة المعتمدة:' : 'Settlement Currency:'}</span>
                        <span className="badge bg-light text-dark border">{displayCurrency}</span>
                      </div>

                      <div className={styles.summaryTotalBox}>
                        <div>
                          <span className={styles.summaryTotalLabel}>
                            {isAr ? 'الإجمالي المطلوب:' : 'Total Amount Due:'}
                          </span>
                          <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                            {isAr ? 'شامل الرسوم والخدمات المختارة' : 'Authoritative Total Amount'}
                          </small>
                        </div>
                        <span className={styles.summaryTotalAmount}>
                          {priceLoading ? '…' : formatAmount(displayTotalDue)} <span style={{ fontSize: '1rem', fontWeight: 600 }}>{displayCurrency}</span>
                        </span>
                      </div>

                      {/* Refund Destination Notice */}
                      <div className="p-2 px-3 bg-light border rounded small text-muted my-3" style={{ fontSize: '0.75rem' }}>
                        <i className="fa-solid fa-circle-info text-info me-1"></i>
                        <span>
                          {isAr
                            ? `وجهة الاسترداد: ${refundAccount?.accountHolderName || user?.fullName} (${refundAccount?.refundMethod === 'BANK_TRANSFER' ? refundAccount.bankName : 'البطاقة الأصلية'}).`
                            : `Refund destination: ${refundAccount?.accountHolderName || user?.fullName} (${refundAccount?.refundMethod === 'BANK_TRANSFER' ? refundAccount.bankName : 'Original Card'}).`}
                        </span>
                      </div>

                      {/* Action Button: Gateway Card OR Manual Proof submission */}
                      {paymentMethod === 'CARD' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-lg w-100 py-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                          onClick={handleInitiateAndPay}
                          disabled={checkoutStep === 'initiating' || checkoutStep === 'processing'}
                        >
                          {checkoutStep === 'initiating' ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                              <span>{isAr ? 'جاري تجهيز جلسة الدفع المشفرة…' : 'Preparing Secure Card Checkout…'}</span>
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-lock"></i>
                              <span className="fw-bold">
                                {isAr
                                  ? `سداد الآن بالبطاقة (${formatAmount(displayTotalDue)} ج.م)`
                                  : `Pay Online (${formatAmount(displayTotalDue)} ${displayCurrency})`}
                              </span>
                              <i className={`fa-solid ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} ms-1`}></i>
                            </>
                          )}
                        </button>
                      ) : activeProof?.status === 'Approved' ? (
                        <Link
                          to="/student/training"
                          className="btn btn-success btn-lg w-100 py-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                        >
                          <i className="fa-solid fa-graduation-cap"></i>
                          <span className="fw-bold">{isAr ? 'الانتقال إلى تدريبي' : 'Access Enrolled Course'}</span>
                        </Link>
                      ) : activeProof?.status === 'Pending' && !forceResubmit ? (
                        <div className="p-3 bg-light border rounded text-center">
                          <span className="badge bg-warning text-dark p-2 px-3 mb-2 d-inline-block">
                            <i className="fa-solid fa-hourglass-half me-1"></i>
                            {isAr ? 'إيصال السداد قيد التدقيق المالي' : 'Proof Under Financial Review'}
                          </span>
                          <p className="small text-muted mb-0">
                            {isAr
                              ? 'سيتم تفعيل الالتحاق تلقائياً بمجرد اعتماد الإيصال من الإدارة المالية.'
                              : 'Enrollment activates immediately upon administrative verification.'}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-lg w-100 py-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                          onClick={handleSubmitProof}
                          disabled={proofSubmitting}
                        >
                          {proofSubmitting ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                              <span>{isAr ? 'جاري رفع الإيصال…' : 'Submitting Proof…'}</span>
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-cloud-arrow-up"></i>
                              <span className="fw-bold">
                                {isAr ? 'تأكيد وإرسال إيصال السداد' : 'Submit Payment Proof'}
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      <p className="text-muted text-center small mt-3 mb-0" style={{ fontSize: '0.72rem' }}>
                        <i className="fa-solid fa-shield-halved me-1 text-success"></i>
                        {isAr
                          ? 'تخضع كافة المعاملات المالية لرقابة وتدقيق الإدارة المالية لوكالة الفضاء المصرية.'
                          : 'All transactions are monitored and audited by Egyptian Space Agency Finance.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : invoices.length > 0 ? (
        <div className="alert alert-success border-0 shadow-sm p-4 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="rounded-circle bg-success text-white p-3 d-flex align-items-center justify-content-center">
              <i className="fa-solid fa-circle-check fs-3"></i>
            </div>
            <div>
              <h5 className="fw-bold text-dark mb-1">
                {isAr ? 'جميع مصاريفك الدراسية مسددة بالكامل' : 'All Course Invoices Are Fully Settled'}
              </h5>
              <p className="text-muted small mb-0">
                {isAr
                  ? 'لا توجد فواتير معلقة بانتظار السداد حالياً. يمكنك استعراض وطباعة الإيصالات الرسمية أدناه.'
                  : 'You have no outstanding tuition due. You can view, verify, and print your official receipts in the ledger below.'}
              </p>
            </div>
          </div>
          <Link to="/student/training" className="btn btn-outline-success btn-sm">
            <i className="fa-solid fa-graduation-cap me-1"></i> {isAr ? 'الانتقال إلى تدريبي' : 'Go to My Training'}
          </Link>
        </div>
      ) : null}

      {/* 5. TABS FILTER & ACTIONS */}
      <div className={styles.ledgerHeader}>
        <ul className={styles.tabList}>
          <li>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <i className="fa-solid fa-receipt"></i>
              <span>{isAr ? 'كافة الفواتير' : 'All Invoices'}</span>
              <span className={styles.tabCountBadge}>{invoices.length}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'pending' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <i className="fa-solid fa-clock"></i>
              <span>{isAr ? 'بانتظار السداد' : 'Pending Payment'}</span>
              <span className={styles.tabCountBadge}>
                {invoices.filter((i) => ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(i.status)).length}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'paid' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('paid')}
            >
              <i className="fa-solid fa-circle-check"></i>
              <span>{isAr ? 'الإيصالات المسددة' : 'Paid Receipts'}</span>
              <span className={styles.tabCountBadge}>
                {invoices.filter((i) => i.status === 'Paid').length}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'refunds' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('refunds')}
            >
              <i className="fa-solid fa-rotate-left"></i>
              <span>{isAr ? 'طلبات الاسترداد' : 'Refund Requests'}</span>
              <span className={styles.tabCountBadge}>{myRefunds.length}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'proofs' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('proofs')}
            >
              <i className="fa-solid fa-file-invoice"></i>
              <span>{isAr ? 'إيصالات السداد المرفوعة' : 'Manual Proofs'}</span>
              <span className={styles.tabCountBadge}>{myProofsList.length}</span>
            </button>
          </li>
        </ul>

        <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
          <i className="fa-solid fa-arrows-rotate me-1"></i> {isAr ? 'تحديث السجلات' : 'Refresh Ledger'}
        </button>
      </div>

      {/* 6. TAB CONTENT: REFUND REQUESTS, PROOFS OR INVOICES LIST */}
      {activeTab === 'refunds' ? (
        <div className="egsa-card p-4 mb-5 shadow-sm bg-white rounded border">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">
              <i className="fa-solid fa-rotate-left me-2 text-primary"></i>
              {isAr ? 'سجل طلبات استرداد المصروفات' : 'My Refund Requests Ledger'}
            </h5>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => setShowPolicyModal(true)}
            >
              <i className="fa-solid fa-book me-1"></i>
              {isAr ? 'مراجعة السياسة' : 'View Policy'}
            </button>
          </div>

          {myRefunds.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fa-solid fa-clipboard-check fs-2 mb-2 d-block text-secondary"></i>
              <p className="mb-0">{isAr ? 'لا توجد طلبات استرداد مقدمة حالياً.' : 'You have not submitted any refund requests.'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th>{isAr ? 'رقم الطلب' : 'Request #'}</th>
                    <th>{isAr ? 'الدورة التدريبية' : 'Course'}</th>
                    <th>{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th>{isAr ? 'وجهة الاسترداد' : 'Destination'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th>{isAr ? 'تاريخ التقديم' : 'Date'}</th>
                    <th>{isAr ? 'ملاحظات الإدارة' : 'Decision Notes'}</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {myRefunds.map((rf) => (
                    <tr key={rf._id}>
                      <td className="fw-bold text-primary">{rf.refundNumber}</td>
                      <td>{rf.course?.title || 'Course'}</td>
                      <td className="fw-bold text-dark">
                        {formatAmount(rf.amount)} {rf.currency || 'EGP'}
                      </td>
                      <td>
                        {rf.refundDestination?.refundMethod === 'BANK_TRANSFER'
                          ? `${rf.refundDestination.bankName || 'Bank'} (${rf.refundDestination.maskedIban || rf.refundDestination.maskedAccount})`
                          : (isAr ? 'البطاقة الأصلية' : 'Original Card')}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            rf.status === 'Refunded'
                              ? 'bg-success'
                              : rf.status === 'Approved'
                              ? 'bg-info'
                              : rf.status === 'Rejected'
                              ? 'bg-danger'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {rf.status}
                        </span>
                      </td>
                      <td>{formatDate(rf.createdAt)}</td>
                      <td className="text-muted">
                        {rf.adminDecision?.decisionNote || (rf.status === 'Pending Review' ? (isAr ? 'قيد المراجعة المالية' : 'Under Review') : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'proofs' ? (
        <div className="egsa-card p-4 mb-5 shadow-sm bg-white rounded border">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">
              <i className="fa-solid fa-receipt me-2 text-primary"></i>
              {isAr ? 'سجل إيصالات السداد اليدوي المرفوعة' : 'Manual Payment Proofs Ledger'}
            </h5>
            <span className="badge bg-light text-muted border">
              {myProofsList.length} {isAr ? 'إيصالات' : 'submissions'}
            </span>
          </div>

          {myProofsList.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fa-solid fa-cloud-arrow-up fs-2 mb-2 d-block text-secondary"></i>
              <p className="mb-0">{isAr ? 'لم تقم برفع أي إيصالات سداد بعد.' : 'You have not submitted any payment proofs yet.'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th>{isAr ? 'الدورة التدريبية' : 'Course'}</th>
                    <th>{isAr ? 'طريقة السداد' : 'Method'}</th>
                    <th>{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th>{isAr ? 'بيانات المحول' : 'Sender Info'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th>{isAr ? 'تاريخ الرفع' : 'Date'}</th>
                    <th>{isAr ? 'الإجراءات والملاحظات' : 'Actions / Notes'}</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {myProofsList.map((prf) => (
                    <tr key={prf._id}>
                      <td className="fw-semibold text-dark">{prf.course?.title || prf.invoice?.course?.title || 'Course'}</td>
                      <td>
                        <span className={`badge ${prf.paymentMethod === 'Vodafone_Cash' ? 'bg-danger' : 'bg-success'}`}>
                          {prf.paymentMethod === 'Vodafone_Cash' ? 'Vodafone Cash' : 'InstaPay'}
                        </span>
                      </td>
                      <td className="fw-bold text-primary">
                        {formatAmount(prf.amount)} {prf.currency || 'EGP'}
                      </td>
                      <td>
                        <div>
                          <strong>{prf.senderIdentifier}</strong>
                          {prf.transactionReference && (
                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                              Ref: {prf.transactionReference}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            prf.status === 'Approved'
                              ? 'bg-success'
                              : prf.status === 'Rejected'
                              ? 'bg-danger'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {prf.status === 'Approved'
                            ? (isAr ? 'معتمد' : 'Approved')
                            : prf.status === 'Rejected'
                            ? (isAr ? 'مرفوض' : 'Rejected')
                            : (isAr ? 'قيد المراجعة' : 'Pending')}
                        </span>
                      </td>
                      <td>{formatDate(prf.createdAt)}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => setViewingProofFile(prf)}
                          >
                            <i className="fa-solid fa-eye me-1"></i>
                            {isAr ? 'معاينة' : 'View'}
                          </button>
                          {prf.status === 'Rejected' && (
                            <span className="text-danger small" title={prf.rejectionReason}>
                              {prf.rejectionReason?.slice(0, 30)}...
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : filteredInvoices.length === 0 && !error ? (
        <div className="egsa-card text-center p-5 mb-5 border-0 shadow-sm bg-white rounded">
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light text-muted mb-3"
            style={{ width: '64px', height: '64px' }}
          >
            <i className="fa-solid fa-receipt fs-2"></i>
          </div>
          <h5 className="fw-bold text-dark mb-1">
            {isAr ? 'لا توجد فواتير دراسية مسجلة' : 'No Course Invoices Available'}
          </h5>
          <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '500px' }}>
            {isAr
              ? 'يتم إصدار الفواتير الدراسية الرسمية فور قبول طلب التحاقك من قبل اللجنة الأكاديمية لوكالة الفضاء المصرية. بمجرد قبول الطلب، ستظهر فاتورتك هنا لتأكيد المقعد وسداد المصروفات.'
              : 'Official tuition invoices are generated once your program application is formally accepted by the EGSA Academic Committee. Once accepted, your invoice will appear here to select your package and finalize enrollment.'}
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/student/programs" className="btn btn-primary btn-sm">
              <i className="fa-solid fa-compass me-1"></i> {isAr ? 'استكشاف البرامج التدريبية' : 'Explore Programs'}
            </Link>
            <Link to="/student/applications" className="btn btn-outline-primary btn-sm">
              <i className="fa-solid fa-file-lines me-1"></i> {isAr ? 'متابعة طلبات الالتحاق' : 'Track My Applications'}
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.invoiceGrid}>
          {filteredInvoices.map((inv) => {
            const course = inv.course || {};
            const isPaid = inv.status === 'Paid';
            const isOverdue =
              inv.status === 'Overdue' ||
              (inv.dueDate && new Date(inv.dueDate) < new Date() && !isPaid);
            const isPayable =
              ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(inv.status) && !isOverdue;

            const baseAmount = inv.baseAmount ?? inv.coursePriceAtPurchase ?? inv.amount;
            const transportationAmount = inv.transportationAmount ?? 0;
            const totalAmount = inv.amount;
            const isSelected = checkoutTarget?.invoice?._id === inv._id;

            return (
              <div
                className={`${styles.invoiceCard} ${isSelected ? styles.invoiceCardActive : ''}`}
                key={inv._id}
              >
                <div>
                  {/* Card Header */}
                  <div className={styles.invoiceCardHeader}>
                    <div style={{ minWidth: 0 }}>
                      <span className="badge bg-light text-primary border mb-1" style={{ fontSize: '0.72rem' }}>
                        {inv.invoiceNumber || `INV-${inv._id.slice(-6).toUpperCase()}`}
                      </span>
                      <h5 className="fw-bold text-dark mb-0 text-truncate" title={course.title}>
                        {course.title || (isAr ? 'مصروفات دورة تدريبية' : 'Course Tuition')}
                      </h5>
                      {inv.cohort?.name && (
                        <small className="text-muted d-block mt-1 text-truncate">
                          <i className="fa-solid fa-users me-1 text-primary"></i>
                          {inv.cohort.name}
                        </small>
                      )}
                    </div>
                    <StatusBadge status={isOverdue && !isPaid ? 'Overdue' : inv.status} />
                  </div>

                  {/* Financial Metrics 2x2 Grid */}
                  <div className={styles.invoiceMetaGrid}>
                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                        {isAr ? 'المصروفات الأساسية:' : 'Base Tuition:'}
                      </span>
                      <strong className="text-dark" style={{ fontSize: '0.9rem' }}>
                        {formatAmount(baseAmount)} {inv.currency || 'EGP'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                        {isAr ? 'الانتقالات:' : 'Transportation:'}
                      </span>
                      <strong className="text-dark" style={{ fontSize: '0.9rem' }}>
                        {Number(transportationAmount) > 0 ? `+${formatAmount(transportationAmount)} ${inv.currency || 'EGP'}` : (isAr ? 'غير مشمولة' : 'None')}
                      </strong>
                    </div>

                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                        {isAr ? 'نوع الباقة:' : 'Package:'}
                      </span>
                      <span className="text-dark fw-medium" style={{ fontSize: '0.82rem' }}>
                        {inv.packageType === 'WITH_TRANSPORTATION'
                          ? (isAr ? 'الدورة + الانتقالات' : 'Course + Transport')
                          : (isAr ? 'الدورة فقط' : 'Course Only')}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                        {isAr ? 'المطلوب نهائياً:' : 'Total Due:'}
                      </span>
                      <span className="fw-bold text-primary" style={{ fontSize: '1.05rem' }}>
                        {formatAmount(totalAmount)} {inv.currency || 'EGP'}
                      </span>
                    </div>
                  </div>

                  {/* Important Dates */}
                  <ul className="list-unstyled small text-muted mb-3 d-flex flex-column gap-1" style={{ fontSize: '0.78rem' }}>
                    <li className="d-flex align-items-center gap-2">
                      <i className="fa-regular fa-calendar-check text-primary" style={{ width: '16px' }}></i>
                      <span>
                        {isAr ? 'تاريخ الإصدار: ' : 'Issued Date: '}
                        {formatDate(inv.issuedAt || inv.createdAt)}
                      </span>
                    </li>
                    <li className="d-flex align-items-center gap-2">
                      <i className="fa-solid fa-hourglass-end text-danger" style={{ width: '16px' }}></i>
                      <span className={isOverdue ? 'text-danger fw-bold' : ''}>
                        {isAr ? 'مهلة السداد (قاعدة ٧٢ ساعة): ' : 'Payment Deadline (72h Rule): '}
                        {inv.dueAt || inv.dueDate
                          ? formatDateTime(inv.dueAt || inv.dueDate)
                          : isAr
                          ? 'محددة لاحقاً'
                          : 'TBA'}
                      </span>
                    </li>
                    {inv.paidAt && (
                      <li className="d-flex align-items-center gap-2">
                        <i className="fa-solid fa-circle-check text-success" style={{ width: '16px' }}></i>
                        <span className="text-success fw-medium">
                          {isAr ? 'تاريخ السداد: ' : 'Paid Date: '}
                          {formatDateTime(inv.paidAt)}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-top mt-auto d-flex gap-2 flex-wrap">
                  {isPaid ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm flex-grow-1"
                        onClick={() =>
                          setReceiptData({
                            invoice: inv,
                            course: inv.course,
                            cohort: inv.cohort,
                            packageType: inv.packageType,
                            amount: inv.amount,
                            currency: inv.currency || 'EGP',
                            paidAt: inv.paidAt || inv.updatedAt,
                            transaction: (inv.transactions && inv.transactions[0]) || null,
                          })
                        }
                      >
                        <i className="fa-solid fa-receipt me-1 text-secondary"></i>
                        {isAr ? 'عرض الإيصال الرسمي' : 'View Official Receipt'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-warning btn-sm"
                        onClick={() => handleOpenRefundModal(inv)}
                        title={isAr ? 'طلب استرداد المصروفات' : 'Request Tuition Refund'}
                      >
                        <i className="fa-solid fa-rotate-left me-1"></i>
                        {isAr ? 'طلب استرداد' : 'Request Refund'}
                      </button>
                    </>
                  ) : isOverdue ? (
                    <div className="alert alert-danger p-2 small mb-0 w-100 text-center">
                      <i className="fa-solid fa-circle-exclamation me-1"></i>
                      {isAr ? 'انتهت مهلة الحجز (٧٢ ساعة)' : 'Reservation Expired (72h Deadline Passed)'}
                    </div>
                  ) : isPayable ? (
                    <button
                      type="button"
                      className={`btn btn-sm w-100 ${isSelected ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        openCheckout({ invoice: inv, course: inv.course, cohort: inv.cohort, application: inv.application });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <i className="fa-solid fa-credit-card me-1"></i>
                      {isSelected
                        ? isAr
                          ? 'محدد حالياً في نموذج السداد'
                          : 'Selected in Payment Form'
                        : isAr
                        ? 'تحديد وسداد الفاتورة'
                        : 'Select & Pay Invoice'}
                    </button>
                  ) : (
                    <span className="text-muted small text-center w-100">
                      {isAr ? 'الحالة: ' : 'Status: '} {inv.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. OFFICIAL INSTITUTIONAL RECEIPT MODAL */}
      {receiptData && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-md, 8px)' }}>
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-satellite-dish me-2"></i>
                  {isAr ? 'إيصال سداد رسمي — وكالة الفضاء المصرية' : 'EGSA Space Academy Official Payment Receipt'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setReceiptData(null)}
                ></button>
              </div>

              <div className="modal-body p-4 text-center">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success text-white mb-3"
                  style={{ width: '64px', height: '64px' }}
                >
                  <i className="fa-solid fa-check fa-2x"></i>
                </div>
                <h4 className="fw-bold text-dark mb-1">
                  {isAr ? 'تم تأكيد السداد وقبول القيد بنجاح' : 'Payment Confirmed & Enrollment Finalized'}
                </h4>
                <p className="text-muted small mb-3">Egyptian Space Agency Academy</p>

                <div className="p-3 bg-light rounded text-start small mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'رقم الفاتورة:' : 'Invoice #:'}</span>
                    <strong className="text-dark">
                      {receiptData.invoice?.invoiceNumber ||
                        `EGSA-INV-${(receiptData.invoice?._id || '').slice(-6).toUpperCase()}`}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'الرقم المرجعي للمعاملة:' : 'Transaction Reference:'}</span>
                    <strong className="text-truncate text-dark" style={{ maxWidth: '200px' }}>
                      {receiptData.transaction?.providerReference ||
                        receiptData.transaction?.transactionId ||
                        'TXN-CONFIRMED-SETTLEMENT'}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'البرنامج التدريبي:' : 'Course:'}</span>
                    <strong className="text-dark">{receiptData.course?.title}</strong>
                  </div>
                  {receiptData.cohort && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">{isAr ? 'الدفعة:' : 'Cohort:'}</span>
                      <strong className="text-dark">{receiptData.cohort?.name || receiptData.cohort}</strong>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'الباقة المختارة:' : 'Selected Package:'}</span>
                    <strong className="text-primary">
                      {receiptData.packageType === 'WITH_TRANSPORTATION'
                        ? isAr
                          ? 'الدورة + الانتقالات'
                          : 'Course + Transportation'
                        : isAr
                        ? 'الدورة فقط'
                        : 'Course Only (Without Transportation)'}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'المبلغ المسدد:' : 'Amount Paid:'}</span>
                    <strong className="text-secondary fs-6">
                      {formatAmount(receiptData.amount)} {receiptData.currency || 'EGP'}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'تاريخ السداد:' : 'Payment Date:'}</span>
                    <strong className="text-dark">{formatDateTime(receiptData.paidAt)}</strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <span className="text-muted">{isAr ? 'الحالة المالية والأكاديمية:' : 'Status:'}</span>
                    <span className="badge bg-success">{isAr ? 'مسدد ومقيد رسمياً' : 'PAID & ENROLLED'}</span>
                  </div>
                </div>

                <p className="text-muted small mb-0">
                  {isAr
                    ? 'تم تأكيد قيدك بنجاح في الدورة التدريبية. تم فتح كافة محتويات التدريب في قسم تدريبي.'
                    : 'Your enrollment is confirmed! Your training materials and schedule are now unlocked under My Training.'}
                </p>
              </div>

              <div className="modal-footer bg-light justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => window.print()}
                >
                  <i className="fa-solid fa-print me-1"></i> {isAr ? 'طباعة الإيصال' : 'Print Receipt'}
                </button>
                <Link to="/student/training" className="btn btn-primary btn-sm">
                  <i className="fa-solid fa-graduation-cap me-1"></i> {isAr ? 'الانتقال إلى تدريبي' : 'Go to My Training'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. OFFICIAL EGSA REFUND POLICY MODAL */}
      {showPolicyModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 rounded">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-shield-halved me-2 text-primary"></i>
                  {isAr ? 'السياسة المالية الرسمية لاسترداد المصروفات — وكالة الفضاء المصرية' : 'EGSA Space Academy Official Refund Policy'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowPolicyModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4 small" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="alert alert-warning py-2 mb-3">
                  <i className="fa-solid fa-triangle-exclamation me-1"></i>
                  {isAr
                    ? 'تخضع كافة طلبات الاسترداد لمراجعة الإدارة المالية واللجنة الأكاديمية لوكالة الفضاء المصرية وفقاً للشروط المعتمدة أدناه.'
                    : 'All refund applications are strictly subject to review by EGSA Academy Administration and authorized finance verification.'}
                </div>

                <h6 className="fw-bold text-dark">{isAr ? '١. مبادئ الاسترداد العامة:' : '1. General Principles:'}</h6>
                <ul className="text-muted mb-3">
                  <li>
                    {isAr
                      ? 'لا يعتبر مجرد تقديم طلب الاسترداد موافقة تلقائية على إعادة الأموال.'
                      : 'Submitting a refund request does not automatically guarantee financial approval.'}
                  </li>
                  <li>
                    {isAr
                      ? 'يتم تقييم كل طلب وفقاً لتواريخ الحجز، جدول الجلسات التدريبية، وأسباب الإلغاء.'
                      : 'Each request is audited based on registration timelines, cohort schedules, and documented justification.'}
                  </li>
                  <li>
                    {isAr
                      ? 'لا تسجل أية عملية استرداد على أنها منتهية إلا بعد تأكيد التحويل المالي الفعلي من البوابة أو التحويل البنكي.'
                      : 'A refund is never recorded as settled until verified confirmation is received from the payment provider or banking institution.'}
                  </li>
                </ul>

                <h6 className="fw-bold text-dark">{isAr ? '٢. قاعدة الـ ٧٢ ساعة وإلغاء البرامج:' : '2. 72-Hour Rule & Academy Cancellations:'}</h6>
                <ul className="text-muted mb-3">
                  <li>
                    {isAr
                      ? 'إذا تم إلغاء البرنامج التدريبي بقرار رسمي من وكالة الفضاء المصرية، يستحق الطالب استرداداً كاملاً (١٠٠٪) دون أية استقطاعات.'
                      : 'If a training program is cancelled by the Egyptian Space Agency, enrolled students receive a full 100% refund.'}
                  </li>
                  <li>
                    {isAr
                      ? 'الانسحاب قبل ٧٢ ساعة من بدء الدورة يخضع لسياسة المراجعة الإدارية.'
                      : 'Withdrawal prior to 72 hours before program commencement is subject to administrative review.'}
                  </li>
                  <li>
                    {isAr
                      ? 'المبالغ المسددة بعد انتهاء المهلة المحددة (٧٢ ساعة) تحال تلقائياً للمطابقة والتسوية المالية.'
                      : 'Payments received after reservation expiration are held for manual reconciliation and refund review.'}
                  </li>
                </ul>

                <h6 className="fw-bold text-dark">{isAr ? '٣. طرق التحويل وأمان البيانات:' : '3. Refund Methods & Data Privacy:'}</h6>
                <ul className="text-muted mb-0">
                  <li>
                    {isAr
                      ? 'تُعاد الأموال المفضلة إلى نفس بطاقة الدفع الأصلية عبر البوابة الإلكترونية، أو لحساب بنكي معتمد باسم الطالب.'
                      : 'Refunds are returned to the original payment method where supported, or via approved bank transfer to a verified account.'}
                  </li>
                  <li>
                    {isAr
                      ? 'تُشفر كافة بيانات الحسابات البنكية بتقنية AES-256-GCM وتُحجب في واجهات العرض حفاظاً على الخصوصية.'
                      : 'Sensitive bank account and IBAN identifiers are encrypted at rest using AES-256-GCM and masked in all displays.'}
                  </li>
                </ul>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4"
                  onClick={() => setShowPolicyModal(false)}
                >
                  {isAr ? 'فهمت الشروط وأوافق عليها' : 'I Understand & Acknowledge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. UPDATE REFUND DESTINATION MODAL */}
      {showAccountModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded">
              <form onSubmit={handleSaveRefundAccount}>
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title fw-bold">
                    <i className="fa-solid fa-building-columns me-2"></i>
                    {isAr ? 'تفاصيل حساب الاسترداد المعتمد' : 'Refund Account Destination Details'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowAccountModal(false)}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  {accountError && <div className="alert alert-danger small p-2 mb-3">{accountError}</div>}

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {isAr ? 'اسم صاحب الحساب بالكامل (مطابق لبطاقة الرقم القومي):' : 'Account Holder Full Legal Name:'}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      value={accountFormData.accountHolderName}
                      onChange={(e) => setAccountFormData({ ...accountFormData, accountHolderName: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {isAr ? 'طريقة الاسترداد المفضلة:' : 'Preferred Refund Method:'}
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={accountFormData.refundMethod}
                      onChange={(e) => setAccountFormData({ ...accountFormData, refundMethod: e.target.value })}
                    >
                      <option value="ORIGINAL_PAYMENT_METHOD">
                        {isAr ? 'البطاقة الأصلية المستخدمة في السداد (تلقائي)' : 'Original Payment Method (Card)'}
                      </option>
                      <option value="BANK_TRANSFER">
                        {isAr ? 'تحويل بنكي رسمي إلى حساب بنكي / IBAN' : 'Bank Transfer (IBAN / Bank Account)'}
                      </option>
                    </select>
                  </div>

                  {accountFormData.refundMethod === 'BANK_TRANSFER' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label small fw-bold">
                          {isAr ? 'اسم البنك:' : 'Bank Name:'}
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. National Bank of Egypt (NBE) / CIB / Banque Misr"
                          required
                          value={accountFormData.bankName}
                          onChange={(e) => setAccountFormData({ ...accountFormData, bankName: e.target.value })}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold">
                          {isAr ? 'رقم الحساب البنكي أو الـ IBAN:' : 'IBAN or Bank Account Number:'}
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. EG3800020001000000123456789"
                          required
                          value={accountFormData.iban || accountFormData.accountNumber}
                          onChange={(e) =>
                            setAccountFormData({
                              ...accountFormData,
                              iban: e.target.value,
                              accountNumber: e.target.value,
                            })
                          }
                        />
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                          <i className="fa-solid fa-lock text-success me-1"></i>
                          {isAr
                            ? 'يتم تشفير هذا الرقم مباشرة بتقنية AES-256 ولن يظهر كاملاً لأي جهة غير مصرح لها.'
                            : 'This identifier is securely encrypted at rest using AES-256 and will never be displayed in plain text.'}
                        </small>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowAccountModal(false)}
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4"
                    disabled={accountSaving}
                  >
                    {accountSaving ? (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    ) : null}
                    {isAr ? 'حفظ وتأكيد البيانات' : 'Save & Confirm Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 10. STUDENT SUBMIT REFUND REQUEST MODAL */}
      {refundTargetInvoice && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded">
              <form onSubmit={handleSubmitRefundRequest}>
                <div className="modal-header bg-warning text-dark">
                  <h5 className="modal-title fw-bold">
                    <i className="fa-solid fa-rotate-left me-2"></i>
                    {isAr ? 'تقديم طلب استرداد المصروفات الدراسية' : 'Submit Tuition Refund Request'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setRefundTargetInvoice(null)}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  {refundModalError && <div className="alert alert-danger small p-2 mb-3">{refundModalError}</div>}

                  <div className="p-3 bg-light rounded small mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">{isAr ? 'الدورة التدريبية:' : 'Course:'}</span>
                      <strong className="text-dark">{refundTargetInvoice.course?.title}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">{isAr ? 'رقم الفاتورة:' : 'Invoice #:'}</span>
                      <strong className="text-dark">{refundTargetInvoice.invoiceNumber}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">{isAr ? 'المبلغ المسدد:' : 'Amount Paid:'}</span>
                      <strong className="text-primary fs-6">
                        {formatAmount(refundTargetInvoice.amount)} {refundTargetInvoice.currency || 'EGP'}
                      </strong>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {isAr ? 'المبلغ المطلوب استرداده (ج.م):' : 'Requested Refund Amount (EGP):'}
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      max={refundTargetInvoice.amount}
                      min={1}
                      required
                      value={refundAmountInput}
                      onChange={(e) => setRefundAmountInput(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {isAr ? 'سبب طلب الاسترداد والتفاصيل:' : 'Reason for Refund Request:'}
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      required
                      placeholder={
                        isAr
                          ? 'يرجى توضيح سبب الرغبة في الانسحاب أو الاسترداد بالتفصيل لمراجعة الإدارة المالية…'
                          : 'Please specify the detailed justification for this refund request for administrative review…'
                      }
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                    />
                  </div>

                  <div className="p-2 px-3 bg-light border rounded small text-muted">
                    <i className="fa-solid fa-circle-check text-success me-1"></i>
                    {isAr
                      ? `سيتم التحويل في حال الموافقة إلى: ${refundAccount?.accountHolderName || user?.fullName} (${refundAccount?.refundMethod === 'BANK_TRANSFER' ? refundAccount.bankName : 'البطاقة الأصلية'}).`
                      : `If approved, the amount will be sent to: ${refundAccount?.accountHolderName || user?.fullName} (${refundAccount?.refundMethod === 'BANK_TRANSFER' ? refundAccount.bankName : 'Original Card'}).`}
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setRefundTargetInvoice(null)}
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning btn-sm px-4 fw-bold"
                    disabled={refundSubmitting}
                  >
                    {refundSubmitting ? (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    ) : null}
                    {isAr ? 'إرسال الطلب للمراجعة' : 'Submit for Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Proof Viewing Modal */}
      {viewingProofFile && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-image me-2 text-primary"></i>
                  {isAr ? 'إيصال السداد المرفوع' : 'Uploaded Payment Proof'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setViewingProofFile(null)}
                ></button>
              </div>
              <div className="modal-body p-4 text-center bg-light">
                <div className="p-2 mb-3 bg-white rounded border d-flex justify-content-between align-items-center flex-wrap gap-2 small">
                  <div>
                    <span className="text-muted me-1">{isAr ? 'الطريقة:' : 'Method:'}</span>
                    <strong className="text-dark">{viewingProofFile.paymentMethod?.replace('_', ' ')}</strong>
                  </div>
                  <div>
                    <span className="text-muted me-1">{isAr ? 'المرسل:' : 'Sender:'}</span>
                    <strong className="text-dark">{viewingProofFile.senderIdentifier}</strong>
                  </div>
                  <div>
                    <span className="text-muted me-1">{isAr ? 'المبلغ:' : 'Amount:'}</span>
                    <strong className="text-primary">{formatAmount(viewingProofFile.amount)} EGP</strong>
                  </div>
                  <div>
                    <span
                      className={`badge ${
                        viewingProofFile.status === 'Approved'
                          ? 'bg-success'
                          : viewingProofFile.status === 'Rejected'
                          ? 'bg-danger'
                          : 'bg-warning text-dark'
                      }`}
                    >
                      {viewingProofFile.status}
                    </span>
                  </div>
                </div>

                <div className="rounded border bg-white p-2 d-inline-block shadow-sm" style={{ maxHeight: '70vh', maxWidth: '100%', overflow: 'auto', minWidth: '280px', minHeight: '180px' }}>
                  {viewingBlobLoading ? (
                    <div className="p-4 text-center text-muted">
                      <div className="spinner-border text-primary spinner-border-sm mb-2" role="status"></div>
                      <div className="small">{isAr ? 'جارٍ تحميل صورة الإيصال بأمان…' : 'Loading receipt image securely…'}</div>
                    </div>
                  ) : viewingBlobError ? (
                    <div className="p-4 text-muted text-center">
                      <i className="fa-solid fa-triangle-exclamation text-warning fs-3 mb-2 d-block"></i>
                      <div className="text-danger small">{viewingBlobError}</div>
                    </div>
                  ) : (
                    <img
                      src={viewingBlobUrl}
                      alt="Payment Proof Receipt"
                      style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
                      className="rounded"
                    />
                  )}
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setViewingProofFile(null)}
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
