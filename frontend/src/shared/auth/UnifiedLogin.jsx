import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { tokens as instructorTokens } from '../../features/instructor/services/api.js';
import AuthShell from './AuthShell.jsx';
import s from './auth.module.css';

export default function UnifiedLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [lang, setLang] = useState(() => localStorage.getItem('egsa_lang') || 'en');
  const isAr = lang === 'ar';

  // Pre-fill demo accounts if user clicks or toggles for testing ease
  const roleDefaults = {
    student: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
    instructor: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
    admin: { email: 'superadmin@esa.dev', password: 'Password123!' },
  };

  const [selectedRole, setSelectedRole] = useState(() => {
    // Check state or URL param or default to student
    const paramRole = searchParams.get('role');
    if (paramRole === 'instructor' || paramRole === 'admin' || paramRole === 'student') return paramRole;
    if (location.pathname.includes('/instructor')) return 'instructor';
    if (location.pathname.includes('/admin')) return 'admin';
    return 'student';
  });

  const [form, setForm] = useState(() => {
    const paramRole = searchParams.get('role');
    const initRole = (paramRole === 'instructor' || paramRole === 'admin' || paramRole === 'student')
      ? paramRole
      : location.pathname.includes('/instructor')
        ? 'instructor'
        : location.pathname.includes('/admin')
          ? 'admin'
          : 'student';
    return roleDefaults[initRole] || { email: '', password: '' };
  });

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(location.state?.message || '');

  useEffect(() => {
    localStorage.setItem('egsa_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMsg(location.state.message);
    }
    if (location.state?.email) {
      setForm((prev) => ({ ...prev, email: location.state.email }));
    }
  }, [location.state]);

  useEffect(() => {
    if (searchParams.get('session_expired') === '1') {
      setError(
        isAr
          ? 'انتهت صلاحية جلستك الأمنية. يرجى تسجيل الدخول مجدداً.'
          : 'Your security session has expired. Please sign in again.'
      );
    }
  }, [searchParams, isAr]);

  const handleRoleSelect = (roleKey) => {
    setSelectedRole(roleKey);
    setError(null);
    setSuccessMsg('');
    // Optionally load default sample credentials for developer convenience
    if (roleDefaults[roleKey]) {
      setForm(roleDefaults[roleKey]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setSuccessMsg('');

    const trimmedEmail = (form.email || '').trim();
    if (!trimmedEmail || !form.password) {
      setError(isAr ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' : 'Please enter your email and password.');
      return;
    }

    setBusy(true);

    try {
      if (selectedRole === 'student') {
        // Clear any stale student session before attempting new login
        localStorage.removeItem('egsa_access_token');
        localStorage.removeItem('egsa_token');
        localStorage.removeItem('egsa_refresh_token');
        localStorage.removeItem('egsa_user');

        // Authenticate against Student Backend (/api/auth/login -> port 5000)
        const response = await axios.post('/api/auth/login', {
          email: trimmedEmail,
          password: form.password,
        });

        const resData = response.data?.data || response.data;
        const effectiveAccess = resData.accessToken || resData.token;
        const userData = resData.user;
        const refresh = resData.refreshToken;

        if (effectiveAccess && userData) {
          localStorage.setItem('egsa_access_token', effectiveAccess);
          localStorage.setItem('egsa_token', effectiveAccess);
          if (refresh) localStorage.setItem('egsa_refresh_token', refresh);
          localStorage.setItem('egsa_user', JSON.stringify(userData));

          const redirectParam = searchParams.get('redirect');
          const fromPath = location.state?.from?.pathname;
          const validRedirect = redirectParam && !redirectParam.startsWith('/login') && !redirectParam.startsWith('/student/login') ? redirectParam : null;
          const validFrom = fromPath && !fromPath.startsWith('/login') && !fromPath.startsWith('/student/login') ? fromPath : null;
          const destination = validRedirect || validFrom || '/student/dashboard';
          navigate(destination, { replace: true });
        } else {
          throw new Error('Unexpected response format from Student backend.');
        }

      } else if (selectedRole === 'instructor') {
        // Clear any stale instructor session
        try { localStorage.removeItem('egsa_refresh'); } catch {}

        // Authenticate against Instructor Backend (/api/v1/auth/login -> port 5100)
        const response = await axios.post('/api/v1/auth/login', {
          email: trimmedEmail,
          password: form.password,
        });

        const resData = response.data?.data || response.data;
        if (resData.accessToken && resData.user) {
          // Instructor app checks egsa_refresh in localStorage and memory accessToken
          instructorTokens.set(resData.accessToken, resData.refreshToken);
          try { localStorage.setItem('egsa_instructor_user', JSON.stringify(resData.user)); } catch {}
          navigate('/instructor/dashboard', { replace: true });
        } else {
          throw new Error('Unexpected response format from Instructor backend.');
        }

      } else if (selectedRole === 'admin') {
        // Clear any stale admin session
        localStorage.removeItem('esa_token');
        localStorage.removeItem('esa_user');

        // Authenticate against Admin Backend (/admin-api/auth/login -> port 5200)
        const response = await axios.post('/admin-api/auth/login', {
          email: trimmedEmail,
          password: form.password,
        });

        const resData = response.data?.data || response.data;
        if (resData.token && resData.user) {
          localStorage.setItem('esa_token', resData.token);
          localStorage.setItem('esa_user', JSON.stringify(resData.user));
          navigate('/admin', { replace: true });
        } else {
          throw new Error('Unexpected response format from Admin backend.');
        }
      }
    } catch (err) {
      console.error('[UnifiedLogin] Authentication error:', err);
      const res = err.response;

      if (!res) {
        setError(
          isAr
            ? 'تعذر الاتصال بخادم البوابة المحددة. يرجى التأكد من تشغيل الخدمة.'
            : 'Unable to connect to the authentication service. Please ensure the backend server is running.'
        );
      } else if (res.status === 401 || res.status === 400) {
        setError(
          res.data?.message ||
          res.data?.error?.message ||
          (isAr
            ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة لهذه البوابة.'
            : 'Invalid email or password for this portal.')
        );
      } else if (res.status === 403) {
        setError(
          res.data?.message ||
          res.data?.error?.message ||
          (isAr
            ? 'هذا الحساب معطل أو غير مفعل. يرجى التواصل مع إدارة الأكاديمية.'
            : 'This account is deactivated or unauthorized for this portal.')
        );
      } else if (res.status === 429) {
        setError(
          isAr
            ? 'تم تجاوز حد المحاولات المسموح به. يرجى الانتظار بضع دقائق.'
            : 'Too many login attempts. Please wait a few minutes and try again.'
        );
      } else {
        setError(
          res.data?.message ||
          res.data?.error?.message ||
          (isAr ? 'حدث خطأ أثناء تسجيل الدخول.' : 'An error occurred during authentication.')
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const titleText = isAr ? 'تسجيل الدخول الموحد' : 'Unified Space Portal';
  const subText = isAr
    ? 'سجّل الدخول للوصول إلى منصات التدريب والمهمات الفضائية.'
    : 'Sign in to access space missions, cohorts, and instructional cockpits.';

  return (
    <AuthShell
      title={titleText}
      sub={subText}
      lang={lang}
      setLang={setLang}
      backTo="/"
      backLabel={isAr ? 'الرئيسية' : 'Academy Home'}
    >
      {/* Success Notification (e.g. redirected from registration) */}
      {successMsg && (
        <Alert variant="success" className="py-2 px-3 mb-3 small d-flex align-items-center" role="alert">
          <i className="fa-solid fa-circle-check me-2 flex-shrink-0" aria-hidden="true" />
          <div>{successMsg}</div>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="py-2 px-3 mb-3 small d-flex align-items-center" role="alert">
          <i className="fa-solid fa-circle-exclamation me-2 flex-shrink-0" aria-hidden="true" />
          <div>{error}</div>
        </Alert>
      )}

      {/* Role Segmented Buttons */}
      <div className={s.roleGroup} role="tablist" aria-label="Portal Selection">
        <button
          type="button"
          role="tab"
          aria-selected={selectedRole === 'student'}
          className={`${s.roleToggleBtn} ${selectedRole === 'student' ? s.roleToggleActive : ''}`}
          onClick={() => handleRoleSelect('student')}
        >
          <i className="fa-solid fa-user-graduate" aria-hidden="true" />
          <span>{isAr ? 'متدرب' : 'Trainee'}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={selectedRole === 'instructor'}
          className={`${s.roleToggleBtn} ${selectedRole === 'instructor' ? s.roleToggleActive : ''}`}
          onClick={() => handleRoleSelect('instructor')}
        >
          <i className="fa-solid fa-chalkboard-user" aria-hidden="true" />
          <span>{isAr ? 'مدرب' : 'Instructor'}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={selectedRole === 'admin'}
          className={`${s.roleToggleBtn} ${selectedRole === 'admin' ? s.roleToggleActive : ''}`}
          onClick={() => handleRoleSelect('admin')}
        >
          <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          <span>{isAr ? 'مسؤول' : 'Admin'}</span>
        </button>
      </div>

      <Form onSubmit={handleSubmit} noValidate>
        {/* Email Address */}
        <Form.Group className="mb-3" controlId="auth-email">
          <Form.Label className="small fw-semibold text-secondary mb-1">
            {isAr ? 'البريد الإلكتروني' : 'Email Address'}
          </Form.Label>
          <div className={s.inputGroupWrap}>
            <i className={`fa-solid fa-envelope ${s.inputIcon}`} aria-hidden="true" />
            <Form.Control
              type="email"
              autoComplete="username"
              placeholder={
                selectedRole === 'student'
                  ? 'trainee@egsa.gov.eg'
                  : selectedRole === 'instructor'
                  ? 'instructor@agency.gov'
                  : 'admin@egsa.gov.eg'
              }
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              isInvalid={touched && (!form.email || !form.email.includes('@'))}
              className={s.controlWithIcon}
              required
            />
          </div>
          <Form.Control.Feedback type="invalid">
            {isAr ? 'يرجى إدخال بريد إلكتروني صالح.' : 'Valid email is required.'}
          </Form.Control.Feedback>
        </Form.Group>

        {/* Password */}
        <Form.Group className="mb-3" controlId="auth-password">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <Form.Label className="small fw-semibold text-secondary mb-0">
              {isAr ? 'كلمة المرور' : 'Password'}
            </Form.Label>
            {selectedRole === 'instructor' ? (
              <Link to="/instructor/forgot-password" className="small text-muted text-decoration-none">
                {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
              </Link>
            ) : selectedRole === 'student' ? (
              <Link to="/student/login" className="small text-muted text-decoration-none">
                {isAr ? 'المساعدة؟' : 'Account Help'}
              </Link>
            ) : null}
          </div>
          <div className={s.inputGroupWrap}>
            <i className={`fa-solid fa-lock ${s.inputIcon}`} aria-hidden="true" />
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              isInvalid={touched && !form.password}
              className={s.controlWithIcon}
              required
            />
            <button
              type="button"
              className={s.togglePassBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
            </button>
          </div>
          <Form.Control.Feedback type="invalid">
            {isAr ? 'كلمة المرور مطلوبة.' : 'Password is required.'}
          </Form.Control.Feedback>
        </Form.Group>

        {/* Submit Button */}
        <Button type="submit" className={`btn-egsa ${s.submitBtn}`} disabled={busy}>
          {busy ? (
            <>
              <Spinner size="sm" className="me-2" />
              <span>{isAr ? 'جارٍ التحقق والولوج…' : 'Authenticating…'}</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-arrow-right-to-bracket me-2" aria-hidden="true" />
              <span>
                {selectedRole === 'student'
                  ? (isAr ? 'دخول بوابة المتدربين' : 'Sign In as Trainee')
                  : selectedRole === 'instructor'
                  ? (isAr ? 'دخول قمرة القيادة' : 'Sign In as Instructor')
                  : (isAr ? 'دخول منصة الإدارة' : 'Sign In as Administrator')}
              </span>
            </>
          )}
        </Button>
      </Form>

      {/* Link to Registration */}
      <div className={s.authSwitch}>
        <span>{isAr ? 'ليس لديك حساب تدريبي بعد؟' : "Don't have an academy account?"}</span>
        <Link to="/register" className={s.authSwitchLink}>
          {isAr ? 'إنشاء حساب جديد' : 'Register Here'}
        </Link>
      </div>
    </AuthShell>
  );
}
