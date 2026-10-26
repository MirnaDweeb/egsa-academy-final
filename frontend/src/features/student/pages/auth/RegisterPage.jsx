import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authTranslations } from '../../utils/authTranslations.js';
import BrandLogo from '../../components/BrandLogo.jsx';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  nationalId: '',
  status: 'student',
  university: '',
  faculty: '',
  department: '',
  graduationYear: '',
  agreeToTerms: false,
};

export default function RegisterPage() {
  const { register, resendVerification, language = 'en', toggleLanguage = () => { }, isRTL = false } = useAuth();
  const t = authTranslations[language] || authTranslations.en;
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Success state for post-registration verification notice
  const [registeredEmail, setRegisteredEmail] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [devLink, setDevLink] = useState(null);

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError('');
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Password rules validation
  const passwordRules = useMemo(() => {
    const p = form.password || '';
    return {
      length: p.length >= 6,
      upper: /[A-Z]/.test(p),
      lower: /[a-z]/.test(p),
      number: /[0-9]/.test(p),
      special: /[^A-Za-z0-9]/.test(p),
    };
  }, [form.password]);

  // Password strength score (0 to 4)
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (passwordRules.length) score++;
    if (passwordRules.upper && passwordRules.lower) score++;
    if (passwordRules.number) score++;
    if (passwordRules.special) score++;
    return score;
  }, [passwordRules]);

  const strengthColor = useMemo(() => {
    if (passwordStrength <= 1) return 'var(--color-danger)';
    if (passwordStrength === 2) return 'var(--color-warning)';
    if (passwordStrength === 3) return 'var(--color-primary)';
    return 'var(--color-secondary)';
  }, [passwordStrength]);

  const strengthLabel = useMemo(() => {
    if (passwordStrength <= 1) return t.strengthWeak;
    if (passwordStrength === 2) return t.strengthFair;
    if (passwordStrength === 3) return t.strengthGood;
    return t.strengthStrong;
  }, [passwordStrength, t]);

  const isNationalIdValid = useMemo(() => {
    if (!form.nationalId) return true; // not validated yet
    return /^\d{14}$/.test(form.nationalId.trim());
  }, [form.nationalId]);

  const passwordsMatch = useMemo(() => {
    if (!form.confirmPassword) return true;
    return form.password === form.confirmPassword;
  }, [form.password, form.confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const clientErrors = {};
    const trimmedFullName = (form.fullName || '').trim();
    const trimmedEmail = (form.email || '').trim();
    const trimmedPhone = (form.phone || '').trim();
    const trimmedNationalId = (form.nationalId || '').trim();

    if (!trimmedFullName) {
      clientErrors.fullName = language === 'ar' ? 'الاسم الكامل مطلوب.' : 'Full Legal Name is required.';
    }

    if (!trimmedEmail) {
      clientErrors.email = language === 'ar' ? 'البريد الإلكتروني مطلوب.' : 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        clientErrors.email = language === 'ar' ? 'صيغة البريد الإلكتروني غير صحيحة.' : 'Please enter a valid email address.';
      }
    }

    if (!trimmedPhone) {
      clientErrors.phone = language === 'ar' ? 'رقم الهاتف مطلوب.' : 'Mobile phone number is required.';
    } else if (!/^(\+?20|0020|0)?1[0125]\d{8}$/.test(trimmedPhone)) {
      clientErrors.phone = language === 'ar'
        ? 'يرجى إدخال رقم هاتف محمول مصري صحيح (مثال: 01012345678 أو +201012345678).'
        : 'Please enter a valid Egyptian mobile number (e.g. 01012345678 or +201012345678).';
    }

    if (!trimmedNationalId) {
      clientErrors.nationalId = language === 'ar' ? 'الرقم القومي مطلوب.' : 'Egyptian National ID is required.';
    } else if (!/^\d{14}$/.test(trimmedNationalId)) {
      clientErrors.nationalId = language === 'ar' ? 'يجب أن يتكون الرقم القومي من ١٤ رقماً بالتمام.' : 'National ID must be exactly 14 digits.';
    }

    if (!form.password) {
      clientErrors.password = language === 'ar' ? 'كلمة المرور مطلوبة.' : 'Password is required.';
    } else if (form.password.length < 6) {
      clientErrors.password = language === 'ar' ? 'كلمة المرور يجب أن لا تقل عن 6 أحرف.' : 'Password must be at least 6 characters.';
    }

    if (!form.confirmPassword) {
      clientErrors.confirmPassword = language === 'ar' ? 'يرجى تأكيد كلمة المرور.' : 'Please confirm your password.';
    } else if (form.password !== form.confirmPassword) {
      clientErrors.confirmPassword = language === 'ar' ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.';
    }

    if (!form.agreeToTerms) {
      clientErrors.agreeToTerms = t.termsRequired || (language === 'ar' ? 'يجب الموافقة على لوائح وأحكام التدريب.' : 'You must accept the training regulations to register.');
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError(language === 'ar' ? 'يرجى تصحيح الأخطاء الموضحة أدناه.' : 'Please correct the highlighted fields below.');
      return;
    }

    setLoading(true);
    try {
      const sanitizedForm = {
        fullName: trimmedFullName,
        email: trimmedEmail,
        phone: trimmedPhone,
        nationalId: trimmedNationalId,
        password: form.password,
        confirmPassword: form.confirmPassword,
        status: form.status,
        university: (form.university || '').trim() || undefined,
        faculty: (form.faculty || '').trim() || (form.university || '').trim() || undefined,
        department: (form.department || '').trim() || undefined,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
        agreeToTerms: true,
      };

      const res = await register(sanitizedForm);
      const successMessage = res?.message || (language === 'ar'
        ? 'تم إنشاء الحساب بنجاح. يرجى تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور.'
        : 'Registration successful. Please log in using your registered email and password.');

      navigate('/login', {
        state: {
          message: successMessage,
          email: trimmedEmail,
        },
        replace: true,
      });
    } catch (err) {
      const resp = err.response;
      const status = resp?.status;
      const data = resp?.data;

      if (status === 400 && Array.isArray(data?.errors) && data.errors.length > 0) {
        const backendFieldErrors = {};
        const messages = [];
        data.errors.forEach((errItem) => {
          if (errItem.field) {
            backendFieldErrors[errItem.field] = errItem.message;
          }
          if (errItem.message) {
            messages.push(errItem.message);
          }
        });
        setFieldErrors(backendFieldErrors);
        setError(messages.join(' '));
      } else if (status === 409) {
        const msg = data?.message || (language === 'ar' ? 'الحساب مسجل بالفعل.' : 'An account with these details already exists.');
        const lowerMsg = (msg || '').toLowerCase();
        const conflictErrors = {};
        if (lowerMsg.includes('email') || lowerMsg.includes('البريد')) {
          conflictErrors.email = msg;
        }
        if (lowerMsg.includes('national') || lowerMsg.includes('القومي') || lowerMsg.includes('id')) {
          conflictErrors.nationalId = msg;
        }
        if (Object.keys(conflictErrors).length > 0) {
          setFieldErrors(conflictErrors);
        }
        setError(msg);
      } else if (status >= 500) {
        setError(language === 'ar' ? 'حدث خطأ في الخادم أثناء معالجة طلبك. يرجى المحاولة لاحقاً.' : 'A server error occurred while processing your registration. Please try again later.');
      } else if (!resp) {
        setError(language === 'ar' ? 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.' : 'Unable to connect to the server. Please check your network connection.');
      } else {
        setError(data?.message || (language === 'ar' ? 'فشل إنشاء الحساب. يرجى مراجعة البيانات.' : 'Registration failed. Please check your data.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendMsg('');
    try {
      const targetEmail = (form.email || '').trim();
      const res = await resendVerification(targetEmail);
      setResendMsg(res?.message || t.resendSuccess);
      if (res?.data?.devVerificationUrl) {
        setDevLink(res.data.devVerificationUrl);
      }
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setResendMsg(err.response?.data?.message || (language === 'ar' ? 'فشل إعادة الإرسال.' : 'Failed to resend.'));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-container-wrapper">
      <div className="auth-card-shell" style={{ maxWidth: 1080 }}>
        {/* Registration Success / Email Verification Screen */}
        {registeredEmail ? (
          <div className="p-4 p-md-5 text-center">
            <div className="d-flex justify-content-end mb-3">
              <button
                type="button"
                className="lang-switch-pill"
                onClick={toggleLanguage}
                aria-label="Toggle language"
              >
                <i className="fa-solid fa-globe text-secondary-egsa"></i>
                <span>{t.switchLang}</span>
              </button>
            </div>

            <div className="mx-auto mb-4" style={{ maxWidth: 540 }}>
              <div
                className="d-inline-flex align-items-center justify-content-center mb-3"
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'var(--color-secondary-subtle)',
                  border: '2px solid var(--color-secondary)',
                }}
              >
                <i className="fa-solid fa-envelope-circle-check fa-2x text-secondary-egsa"></i>
              </div>

              <span className={`badge ${emailSentStatus ? 'bg-secondary-subtle text-secondary-egsa' : 'bg-warning-subtle text-warning-emphasis'} px-3 py-1 rounded-pill mb-2 fw-semibold`}>
                {emailSentStatus ? t.regSuccessTitle : (language === 'ar' ? 'تم إنشاء الحساب' : 'Account Created')}
              </span>
              <h2 className="fw-bold mb-2 text-dark">
                {emailSentStatus ? t.regSuccessHeading : (language === 'ar' ? 'تأكيد التسجيل' : 'Account Registered')}
              </h2>
              <p className="text-muted mb-4">
                {emailSentStatus ? t.regSuccessDesc : (t.regSuccessEmailFailed || (language === 'ar' ? 'تم إنشاء الحساب بنجاح، ولكن تعذر إرسال بريد التأكيد حالياً. يرجى المحاولة لاحقاً.' : 'Registration successful, but the confirmation email could not be sent. Please try again later.'))}
              </p>

              <div className="p-3 bg-surface-subtle border rounded-3 font-monospace fw-bold text-primary-egsa mb-4 fs-5">
                {registeredEmail}
              </div>

              <p className="small text-muted mb-4">
                {emailSentStatus ? t.regSuccessNotice : (t.regSuccessNoticeFailed || (language === 'ar' ? 'تم حفظ حساب المتدرب في قاعدة البيانات، ولكن تعذر إرسال بريد التأكيد لعدم توفر خادم البريد حالياً.' : 'Your cadet account has been saved in our database. However, our email service is currently unavailable or SMTP credentials are not configured.'))}
              </p>

              {devLink && (
                <div className="alert alert-warning py-3 px-3 small mb-4 text-start">
                  <div className="fw-bold mb-1 text-dark">
                    <i className="fa-solid fa-code me-1 text-warning-emphasis"></i> Development Environment Notice:
                  </div>
                  <div className="text-muted mb-2">
                    SMTP is configured with placeholder values in .env. To activate this account in development mode, click below:
                  </div>
                  <a href={devLink} className="btn btn-sm btn-primary w-100 fw-bold">
                    <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>
                    Verify Email Address Now (Dev Mode)
                  </a>
                </div>
              )}

              <div className="d-grid gap-2 mb-4">
                <Link to="/login" className="btn btn-primary py-2 fw-semibold">
                  <i className="fa-solid fa-arrow-right-to-bracket me-2"></i>
                  {t.openLoginBtn}
                </Link>
              </div>

              <div className="border-top pt-4">
                <p className="small text-muted mb-2">{t.didNotReceive}</p>
                {resendMsg && (
                  <div className="alert alert-info py-2 small mb-3">
                    <i className="fa-solid fa-circle-info me-2"></i>
                    {resendMsg}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resendLoading}
                >
                  {resendLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      {t.resending}
                    </>
                  ) : resendCooldown > 0 ? (
                    `${t.resendVerificationBtn} (${resendCooldown}s)`
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane me-1"></i>
                      {t.resendVerificationBtn}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Two-Panel Aerospace Layout */
          <div className="row g-0">
            {/* Left Hero Panel */}
            <div className="col-lg-5 auth-hero-banner d-none d-lg-flex">
              <div>
                <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-4" style={{ background: 'rgba(212, 184, 124, 0.15)', border: '1px solid rgba(212, 184, 124, 0.3)', color: '#D4B87C', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  <BrandLogo height={22} className="me-1" />
                  <span>{t.brandTag}</span>
                </div>

                <h2 className="fw-bold mb-3 text-white" style={{ fontSize: '1.85rem', lineHeight: 1.25 }}>
                  {t.missionTitle}
                </h2>
                <p className="text-light opacity-75 mb-5" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {t.missionSubtitle}
                </p>

                <div className="d-flex flex-column gap-4">
                  <div className="d-flex align-items-start gap-3">
                    <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <i className="fa-solid fa-microchip text-accent-light"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.88rem' }}>{t.pillar1Title}</h6>
                      <p className="text-light opacity-75 mb-0" style={{ fontSize: '0.78rem' }}>{t.pillar1Desc}</p>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-3">
                    <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <i className="fa-solid fa-certificate text-secondary-light"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.88rem' }}>{t.pillar2Title}</h6>
                      <p className="text-light opacity-75 mb-0" style={{ fontSize: '0.78rem' }}>{t.pillar2Desc}</p>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-3">
                    <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <i className="fa-solid fa-atom text-accent-light"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.88rem' }}>{t.pillar3Title}</h6>
                      <p className="text-light opacity-75 mb-0" style={{ fontSize: '0.78rem' }}>{t.pillar3Desc}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-top border-white-50 text-white-50 small">
                <span>EGSA Space Academy &copy; {new Date().getFullYear()}</span>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="col-lg-7 p-4 p-md-5">
              {/* Top Bar with Language Toggle */}
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-satellite-dish text-primary-egsa fa-lg"></i>
                  <span className="fw-bold text-dark small">{t.portalName}</span>
                </div>
                <button
                  type="button"
                  className="lang-switch-pill"
                  onClick={toggleLanguage}
                  aria-label="Toggle language"
                >
                  <i className="fa-solid fa-globe text-secondary-egsa"></i>
                  <span>{t.switchLang}</span>
                </button>
              </div>

              <div className="mb-4">
                <h3 className="fw-bold mb-1 text-dark">{t.registerTitle}</h3>
                <p className="text-muted small mb-0">{t.registerSubtitle}</p>
              </div>

              {error && (
                <div className="alert alert-danger py-2 d-flex align-items-center gap-2 small" role="alert">
                  <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                {/* 1. PERSONAL INFORMATION */}
                <div className="auth-section-divider">
                  <span className="auth-section-number">1</span>
                  <span>{t.personalInfoTitle}</span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="fullName">
                      {t.fullNameLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      className={`form-control ${fieldErrors.fullName ? 'is-invalid' : ''}`}
                      value={form.fullName}
                      onChange={update('fullName')}
                      placeholder={t.fullNamePlaceholder}
                      autoComplete="name"
                      required
                    />
                    {fieldErrors.fullName && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.fullName}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="email">
                      {t.emailLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                      value={form.email}
                      onChange={update('email')}
                      placeholder={t.emailPlaceholder}
                      autoComplete="email"
                      required
                    />
                    {fieldErrors.email && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.email}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="phone">
                      {t.phoneLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      className={`form-control ${fieldErrors.phone ? 'is-invalid' : ''}`}
                      value={form.phone}
                      onChange={update('phone')}
                      placeholder={t.phonePlaceholder}
                      autoComplete="tel"
                      required
                    />
                    {fieldErrors.phone && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.phone}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="nationalId">
                      {t.nationalIdLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="nationalId"
                      type="text"
                      maxLength={14}
                      className={`form-control font-monospace ${fieldErrors.nationalId || (form.nationalId && !isNationalIdValid) ? 'is-invalid' : ''}`}
                      value={form.nationalId}
                      onChange={update('nationalId')}
                      placeholder={t.nationalIdPlaceholder}
                      required
                    />
                    {(fieldErrors.nationalId || (form.nationalId && !isNationalIdValid)) && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.nationalId || (language === 'ar' ? 'الرقم القومي يجب أن يتكون من ١٤ رقماً بالتمام.' : 'National ID must be exactly 14 digits.')}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. ACADEMIC INFORMATION */}
                <div className="auth-section-divider">
                  <span className="auth-section-number">2</span>
                  <span>{t.academicInfoTitle}</span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="status">
                      {t.statusLabel} <span className="text-danger">*</span>
                    </label>
                    <select
                      id="status"
                      className={`form-select ${fieldErrors.status ? 'is-invalid' : ''}`}
                      value={form.status}
                      onChange={update('status')}
                      required
                    >
                      <option value="student">{t.statusStudent || 'Undergraduate Student'}</option>
                      <option value="graduate">{t.statusGraduate || 'Graduate'}</option>
                      <option value="practicing_engineer">{language === 'ar' ? 'مهندس ممارس' : 'Practicing Engineer'}</option>
                    </select>
                    {fieldErrors.status && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.status}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="graduationYear">
                      {t.graduationYearLabel}
                    </label>
                    <input
                      id="graduationYear"
                      type="number"
                      min={1990}
                      max={2100}
                      className="form-control"
                      value={form.graduationYear}
                      onChange={update('graduationYear')}
                      placeholder={t.graduationYearPlaceholder}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="university">
                      {t.universityLabel}
                    </label>
                    <input
                      id="university"
                      type="text"
                      className={`form-control ${fieldErrors.university ? 'is-invalid' : ''}`}
                      value={form.university}
                      onChange={update('university')}
                      placeholder={t.universityPlaceholder}
                    />
                    {fieldErrors.university && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.university}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="faculty">
                      {t.facultyLabel}
                    </label>
                    <input
                      id="faculty"
                      type="text"
                      className={`form-control ${fieldErrors.faculty ? 'is-invalid' : ''}`}
                      value={form.faculty}
                      onChange={update('faculty')}
                      placeholder={t.facultyPlaceholder}
                    />
                    {fieldErrors.faculty && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.faculty}
                      </div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold" htmlFor="department">
                      {t.departmentLabel}
                    </label>
                    <input
                      id="department"
                      type="text"
                      className="form-control"
                      value={form.department}
                      onChange={update('department')}
                      placeholder={t.departmentPlaceholder}
                    />
                  </div>
                </div>

                {/* 3. SECURITY & ACCESS */}
                <div className="auth-section-divider">
                  <span className="auth-section-number">3</span>
                  <span>{t.securityTitle}</span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="password">
                      {t.passwordLabel} <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                        value={form.password}
                        onChange={update('password')}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary px-3"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t.hidePassword : t.showPassword}
                      >
                        <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.password}
                      </div>
                    )}

                    {/* Password Strength Indicator */}
                    {form.password && (
                      <div className="password-strength-container">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                            {language === 'ar' ? 'قوة كلمة المرور:' : 'Password strength:'}
                          </span>
                          <span className="fw-bold" style={{ fontSize: '0.72rem', color: strengthColor }}>
                            {strengthLabel}
                          </span>
                        </div>
                        <div className="password-meter-track">
                          <div
                            className="password-meter-segment"
                            style={{ backgroundColor: passwordStrength >= 1 ? strengthColor : 'transparent' }}
                          />
                          <div
                            className="password-meter-segment"
                            style={{ backgroundColor: passwordStrength >= 2 ? strengthColor : 'transparent' }}
                          />
                          <div
                            className="password-meter-segment"
                            style={{ backgroundColor: passwordStrength >= 3 ? strengthColor : 'transparent' }}
                          />
                          <div
                            className="password-meter-segment"
                            style={{ backgroundColor: passwordStrength >= 4 ? strengthColor : 'transparent' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="confirmPassword">
                      {t.confirmPasswordLabel} <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        className={`form-control ${fieldErrors.confirmPassword || (form.confirmPassword && !passwordsMatch) ? 'is-invalid' : ''}`}
                        value={form.confirmPassword}
                        onChange={update('confirmPassword')}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary px-3"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? t.hidePassword : t.showPassword}
                      >
                        <i className={`fa-regular ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {(fieldErrors.confirmPassword || (form.confirmPassword && !passwordsMatch)) && (
                      <div className="invalid-feedback small d-block">
                        {fieldErrors.confirmPassword || (language === 'ar' ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Password Requirements Checklist */}
                <div className="password-checklist mt-2 p-2 bg-surface-subtle rounded-2">
                  <div className={`password-req-item ${passwordRules.length ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.length ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqLength}</span>
                  </div>
                  <div className={`password-req-item ${passwordRules.upper ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.upper ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqUpper}</span>
                  </div>
                  <div className={`password-req-item ${passwordRules.lower ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.lower ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqLower}</span>
                  </div>
                  <div className={`password-req-item ${passwordRules.number ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.number ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqNumber}</span>
                  </div>
                  <div className={`password-req-item ${passwordRules.special ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.special ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqSpecial}</span>
                  </div>
                </div>

                {/* Terms Agreement */}
                <div className="form-check my-4">
                  <input
                    id="agreeToTerms"
                    type="checkbox"
                    className={`form-check-input ${fieldErrors.agreeToTerms ? 'is-invalid' : ''}`}
                    checked={form.agreeToTerms}
                    onChange={update('agreeToTerms')}
                    required
                  />
                  <label className="form-check-label small" htmlFor="agreeToTerms">
                    {t.termsAgreement}
                  </label>
                  {fieldErrors.agreeToTerms && (
                    <div className="text-danger small mt-1">
                      {fieldErrors.agreeToTerms}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2 fw-semibold shadow-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {t.creatingAccountBtn}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-user-plus me-2"></i>
                      {t.createAccountBtn}
                    </>
                  )}
                </button>

                <div className="text-center mt-3 pt-2">
                  <span className="text-muted small me-2">{t.alreadyHaveAccount}</span>
                  <Link to="/login" className="small fw-bold text-primary-egsa">
                    {t.signInLink}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

