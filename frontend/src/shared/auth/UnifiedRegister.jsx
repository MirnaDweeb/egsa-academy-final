import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import axios from 'axios';
import AuthShell from './AuthShell.jsx';
import s from './auth.module.css';

export default function UnifiedRegister() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => localStorage.getItem('egsa_lang') || 'en');
  const isAr = lang === 'ar';

  // Step state: 'choose-role' | 'student-form' | 'instructor-form' | 'success'
  const [step, setStep] = useState('choose-role');
  const [selectedRole, setSelectedRole] = useState(null); // 'student' | 'instructor'

  // Student Form Data
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    nationalId: '',
    password: '',
    confirmPassword: '',
    status: 'student',
    university: '',
    faculty: '',
    department: '',
    graduationYear: '',
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(null);

  // Success summary payload
  const [successInfo, setSuccessInfo] = useState(null);

  // National ID validation: exactly 14 digits
  const isNationalIdValid = useMemo(() => {
    if (!studentForm.nationalId) return true;
    return /^\d{14}$/.test(studentForm.nationalId.trim());
  }, [studentForm.nationalId]);

  const passwordsMatch = useMemo(() => {
    if (!studentForm.confirmPassword) return true;
    return studentForm.password === studentForm.confirmPassword;
  }, [studentForm.password, studentForm.confirmPassword]);

  // Handle role card selection
  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setError(null);
    setTouched(false);
    if (role === 'student') {
      setStep('student-form');
    } else if (role === 'instructor') {
      setStep('instructor-form');
    }
  };

  // Submit Student Registration
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError(null);

    const trimmedEmail = (studentForm.email || '').trim().toLowerCase();
    const trimmedFullName = (studentForm.fullName || '').trim();
    const trimmedPhone = (studentForm.phone || '').trim();
    const trimmedNationalId = (studentForm.nationalId || '').trim();

    if (!trimmedFullName || !trimmedEmail || !trimmedPhone || !trimmedNationalId || !studentForm.password) {
      setError(isAr ? 'يرجى استكمال جميع الحقول الشخصية الأساسية.' : 'Please fill in all required personal registration fields.');
      return;
    }

    if (!/^\d{14}$/.test(trimmedNationalId)) {
      setError(isAr ? 'يجب أن يتكون الرقم القومي من ١٤ رقماً بالضبط.' : 'National ID must be exactly 14 digits.');
      return;
    }

    if (studentForm.password.length < 6) {
      setError(isAr ? 'يجب ألا تقل كلمة المرور عن ٦ أحرف.' : 'Password must be at least 6 characters long.');
      return;
    }

    if (studentForm.password !== studentForm.confirmPassword) {
      setError(isAr ? 'كلمات المرور غير متطابقة.' : 'Password and confirmation password do not match.');
      return;
    }

    if (!studentForm.agreeToTerms) {
      setError(isAr ? 'يجب الموافقة على شروط وقواعد الأكاديمية للمتابعة.' : 'You must accept the academy terms and conditions.');
      return;
    }

    setBusy(true);

    try {
      // Call Student Backend API directly (POST /api/auth/register)
      const payload = {
        fullName: trimmedFullName,
        email: trimmedEmail,
        password: studentForm.password,
        confirmPassword: studentForm.confirmPassword,
        phone: trimmedPhone,
        nationalId: trimmedNationalId,
        status: studentForm.status,
        university: studentForm.university.trim() || undefined,
        faculty: studentForm.faculty.trim() || undefined,
        department: studentForm.department.trim() || undefined,
        graduationYear: studentForm.graduationYear ? Number(studentForm.graduationYear) : undefined,
        agreeToTerms: true,
      };

      const response = await axios.post('/api/auth/register', payload);

      setSuccessInfo({
        role: 'student',
        email: trimmedEmail,
        fullName: trimmedFullName,
        message: response.data?.message || (isAr
          ? 'تم إنشاء حساب المتدرب بنجاح! يمكنك الآن تسجيل الدخول مباشرةً.'
          : 'Student registration completed successfully! You can now log in to access training cohorts.'),
      });
      setStep('success');

    } catch (err) {
      console.error('[UnifiedRegister] Student registration error:', err);
      const res = err.response;
      if (!res) {
        setError(isAr ? 'تعذر الاتصال بخادم التسجيل. يرجى التأكد من تشغيل الخدمة.' : 'Unable to connect to the backend server. Please verify the system is running.');
      } else if (res.status === 409) {
        setError(res.data?.message || (isAr ? 'يوجد حساب مسجل بالفعل بهذا البريد الإلكتروني أو الرقم القومي.' : 'An account with this email address or National ID already exists.'));
      } else {
        setError(res.data?.message || (isAr ? 'فشل إنشاء الحساب. يرجى مراجعة البيانات.' : 'Registration failed. Please check your data.'));
      }
    } finally {
      setBusy(false);
    }
  };

  // Instructor Accreditation - Informative / Administrative Protocol (No fake submission)
  const handleInstructorAcknowledge = () => {
    // Navigate directly to instructor login or admin platform
    navigate('/login?role=instructor');
  };

  // -------------------------------------------------------------
  // Render Step 1: Role Choice
  // -------------------------------------------------------------
  if (step === 'choose-role') {
    return (
      <AuthShell
        title={isAr ? 'انضم إلى أكاديمية الفضاء' : 'Join EGSA Academy'}
        sub={isAr ? 'اختر نوع الحساب الذي تود الانضمام به للمنظومة الفضائية.' : 'Select your primary role to begin your aerospace journey.'}
        lang={lang}
        setLang={setLang}
        backTo="/"
        backLabel={isAr ? 'الرئيسية' : 'Academy Home'}
      >
        <div className={s.roleCardsGrid}>
          {/* Student Role Card */}
          <button
            type="button"
            className={`${s.roleCard} ${selectedRole === 'student' ? s.roleCardActive : ''}`}
            onClick={() => handleSelectRole('student')}
          >
            <div className={s.roleCardIcon}>
              <i className="fa-solid fa-user-astronaut" aria-hidden="true" />
            </div>
            <div>
              <h3 className={s.roleCardTitle}>{isAr ? 'متدرب / طالب فضاء' : 'Space Cadet / Trainee'}</h3>
              <p className={s.roleCardDesc}>
                {isAr
                  ? 'الالتحاق بالدفعات التدريبية، إتمام اختبارات الجاهزية، تسليم التكليفات والحصول على شهادات معتمدة من وكالة الفضاء المصرية.'
                  : 'Enroll in satellite and space systems cohorts, complete readiness assessments, submit coursework, and earn official EGSA certifications.'}
              </p>
              <span className={s.roleBadge}>
                {isAr ? 'تسجيل فوري مباشر' : 'Direct Instant Registration'}
              </span>
            </div>
          </button>

          {/* Instructor Role Card */}
          <button
            type="button"
            className={`${s.roleCard} ${selectedRole === 'instructor' ? s.roleCardActive : ''}`}
            onClick={() => handleSelectRole('instructor')}
          >
            <div className={s.roleCardIcon}>
              <i className="fa-solid fa-chalkboard-user" aria-hidden="true" />
            </div>
            <div>
              <h3 className={s.roleCardTitle}>{isAr ? 'عضو هيئة تدريب / باحث فضاء' : 'Instructor / Faculty'}</h3>
              <p className={s.roleCardDesc}>
                {isAr
                  ? 'تقديم طلب اعتماد تدريبي لقيادة الدفعات، تقييم المشاريع الهندسية، وإدارة المحاضرات الفضائية المتخصصة.'
                  : 'Apply for institutional accreditation to lead training cohorts, evaluate engineering projects, and instruct space curricula.'}
              </p>
              <span className={`${s.roleBadge} ${s.roleBadgeWarn}`}>
                {isAr ? 'يتطلب فحص الإدارة والاعتماد' : 'Subject to Institutional Review'}
              </span>
            </div>
          </button>
        </div>

        <div className={s.authSwitch}>
          <span>{isAr ? 'لديك حساب بالفعل؟' : 'Already have an academy account?'}</span>
          <Link to="/login" className={s.authSwitchLink}>
            {isAr ? 'تسجيل الدخول' : 'Sign In'}
          </Link>
        </div>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------
  // Render Step 2A: Student Registration Form
  // -------------------------------------------------------------
  if (step === 'student-form') {
    return (
      <AuthShell
        title={isAr ? 'تسجيل حساب متدرب جديد' : 'Student Cadet Registration'}
        sub={isAr ? 'أدخل بياناتك الرسمية للانضمام إلى برامج وكالة الفضاء المصرية.' : 'Enter your official credentials to register for EGSA training cohorts.'}
        lang={lang}
        setLang={setLang}
        isWide={true}
        backTo="/register"
        backLabel={isAr ? 'تغيير الدور' : 'Change Role'}
      >
        {error && (
          <Alert variant="danger" className="py-2 px-3 mb-3 small d-flex align-items-center" role="alert">
            <i className="fa-solid fa-circle-exclamation me-2 flex-shrink-0" aria-hidden="true" />
            <div>{error}</div>
          </Alert>
        )}

        <Form onSubmit={handleStudentSubmit} noValidate>
          {/* Full Name */}
          <Form.Group className="mb-3" controlId="stud-fullname">
            <Form.Label className="small fw-semibold text-secondary mb-1">
              {isAr ? 'الاسم رباعي (كما في البطاقة الرسمية)' : 'Full Legal Name'} <span className="text-danger">*</span>
            </Form.Label>
            <div className={s.inputGroupWrap}>
              <i className={`fa-solid fa-user ${s.inputIcon}`} aria-hidden="true" />
              <Form.Control
                type="text"
                placeholder={isAr ? 'أحمد محمد علي حسن' : 'Ahmed Mohamed Ali'}
                value={studentForm.fullName}
                onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                isInvalid={touched && !studentForm.fullName.trim()}
                className={s.controlWithIcon}
                required
              />
            </div>
          </Form.Group>

          {/* Email & Phone Grid */}
          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <Form.Group controlId="stud-email">
                <Form.Label className="small fw-semibold text-secondary mb-1">
                  {isAr ? 'البريد الإلكتروني' : 'Email Address'} <span className="text-danger">*</span>
                </Form.Label>
                <div className={s.inputGroupWrap}>
                  <i className={`fa-solid fa-envelope ${s.inputIcon}`} aria-hidden="true" />
                  <Form.Control
                    type="email"
                    placeholder="student@example.com"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    isInvalid={touched && (!studentForm.email || !studentForm.email.includes('@'))}
                    className={s.controlWithIcon}
                    required
                  />
                </div>
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group controlId="stud-phone">
                <Form.Label className="small fw-semibold text-secondary mb-1">
                  {isAr ? 'رقم الهاتف المحمول' : 'Mobile Phone'} <span className="text-danger">*</span>
                </Form.Label>
                <div className={s.inputGroupWrap}>
                  <i className={`fa-solid fa-phone ${s.inputIcon}`} aria-hidden="true" />
                  <Form.Control
                    type="tel"
                    placeholder="01012345678"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    isInvalid={touched && !studentForm.phone.trim()}
                    className={s.controlWithIcon}
                    required
                  />
                </div>
              </Form.Group>
            </div>
          </div>

          {/* National ID */}
          <Form.Group className="mb-3" controlId="stud-nid">
            <Form.Label className="small fw-semibold text-secondary mb-1">
              {isAr ? 'الرقم القومي المصري (١٤ رقماً)' : 'Egyptian National ID (14 digits)'} <span className="text-danger">*</span>
            </Form.Label>
            <div className={s.inputGroupWrap}>
              <i className={`fa-solid fa-id-card ${s.inputIcon}`} aria-hidden="true" />
              <Form.Control
                type="text"
                maxLength={14}
                placeholder="29901011234567"
                value={studentForm.nationalId}
                onChange={(e) => setStudentForm({ ...studentForm, nationalId: e.target.value.replace(/\D/g, '') })}
                isInvalid={touched && (!studentForm.nationalId || !isNationalIdValid)}
                className={s.controlWithIcon}
                required
              />
            </div>
            <Form.Text className="text-muted small">
              {isAr ? 'مطلوب للتحقق وإصدار الشهادات المعتمدة من وكالة الفضاء.' : 'Required for official EGSA credential verification.'}
            </Form.Text>
          </Form.Group>

          {/* Academic Background */}
          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <Form.Group controlId="stud-univ">
                <Form.Label className="small fw-semibold text-secondary mb-1">
                  {isAr ? 'الجامعة / الكلية' : 'University / Faculty'}
                </Form.Label>
                <div className={s.inputGroupWrap}>
                  <i className={`fa-solid fa-graduation-cap ${s.inputIcon}`} aria-hidden="true" />
                  <Form.Control
                    type="text"
                    placeholder={isAr ? 'جامعة القاهرة - كلية الهندسة' : 'Cairo University - Engineering'}
                    value={studentForm.university}
                    onChange={(e) => setStudentForm({ ...studentForm, university: e.target.value })}
                    className={s.controlWithIcon}
                  />
                </div>
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group controlId="stud-status">
                <Form.Label className="small fw-semibold text-secondary mb-1">
                  {isAr ? 'الحالة الأكاديمية' : 'Academic Status'}
                </Form.Label>
                <Form.Select
                  value={studentForm.status}
                  onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value })}
                  className={s.controlWithIcon}
                  style={{ paddingInlineStart: '1rem' }}
                >
                  <option value="student">{isAr ? 'طالب جامعي' : 'Undergraduate Student'}</option>
                  <option value="graduated">{isAr ? 'خريج' : 'Graduate'}</option>
                  <option value="working">{isAr ? 'مهندس / ممارس مهني' : 'Practicing Engineer'}</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>

          {/* Passwords Grid */}
          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <Form.Group controlId="stud-pass">
                <Form.Label className="small fw-semibold text-secondary mb-1">
                  {isAr ? 'كلمة المرور (٦ أحرف على الأقل)' : 'Password (min. 6)'} <span className="text-danger">*</span>
                </Form.Label>
                <div className={s.inputGroupWrap}>
                  <i className={`fa-solid fa-lock ${s.inputIcon}`} aria-hidden="true" />
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                    isInvalid={touched && (!studentForm.password || studentForm.password.length < 6)}
                    className={s.controlWithIcon}
                    required
                  />
                  <button
                    type="button"
                    className={s.togglePassBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password"
                  >
                    <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
                  </button>
                </div>
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group controlId="stud-cpass">
                <Form.Label className="small fw-semibold text-secondary mb-1">
                  {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'} <span className="text-danger">*</span>
                </Form.Label>
                <div className={s.inputGroupWrap}>
                  <i className={`fa-solid fa-lock ${s.inputIcon}`} aria-hidden="true" />
                  <Form.Control
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={studentForm.confirmPassword}
                    onChange={(e) => setStudentForm({ ...studentForm, confirmPassword: e.target.value })}
                    isInvalid={touched && (!studentForm.confirmPassword || !passwordsMatch)}
                    className={s.controlWithIcon}
                    required
                  />
                  <button
                    type="button"
                    className={s.togglePassBtn}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label="Toggle confirm password"
                  >
                    <i className={showConfirmPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
                  </button>
                </div>
              </Form.Group>
            </div>
          </div>

          {/* Terms Checkbox */}
          <Form.Group className="mb-3" controlId="stud-terms">
            <Form.Check
              type="checkbox"
              id="agreeToTerms"
              checked={studentForm.agreeToTerms}
              onChange={(e) => setStudentForm({ ...studentForm, agreeToTerms: e.target.checked })}
              label={
                <span className="small text-secondary">
                  {isAr ? 'أوافق على اللوائح التنظيمية وشروط الأكاديمية وصحة البيانات المدخلة.' : 'I accept EGSA Academy terms, guidelines, and confirm the accuracy of my data.'}
                </span>
              }
              isInvalid={touched && !studentForm.agreeToTerms}
              required
            />
          </Form.Group>

          <Button type="submit" className={`btn-egsa ${s.submitBtn}`} disabled={busy}>
            {busy ? (
              <>
                <Spinner size="sm" className="me-2" />
                <span>{isAr ? 'جارٍ تسجيل الحساب…' : 'Registering Cadet…'}</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-user-plus me-2" aria-hidden="true" />
                <span>{isAr ? 'إنشاء حساب المتدرب' : 'Complete Student Registration'}</span>
              </>
            )}
          </Button>
        </Form>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------
  // Render Step 2B: Instructor Accreditation & Institutional Review Protocol
  // -------------------------------------------------------------
  if (step === 'instructor-form') {
    return (
      <AuthShell
        title={isAr ? 'اعتماد هيئة التدريب الأكاديمية' : 'Instructor Faculty Accreditation'}
        sub={isAr ? 'الإجراءات التنظيمية لانضمام أعضاء هيئة التدريب بأكاديمية الفضاء.' : 'Institutional protocol for instructional faculty appointments at EGSA Academy.'}
        lang={lang}
        setLang={setLang}
        isWide={true}
        backTo="/register"
        backLabel={isAr ? 'تغيير الدور' : 'Change Role'}
      >
        {/* Authoritative Regulatory Notice Box */}
        <div className={`${s.noticeBox} ${s.noticeBoxInfo}`} style={{ marginBottom: '1.5rem' }}>
          <i className="fa-solid fa-building-shield me-2" aria-hidden="true" />
          <strong className="d-block mb-1">
            {isAr ? 'إجراء تنظيمي معتمد:' : 'Accreditation Protocol Notice:'}
          </strong>
          <span>
            {isAr
              ? 'إن الانضمام إلى هيئة التدريس والتدريب بوكالة الفضاء المصرية هو تعيين مؤسسي يخضع للتقييم الأكاديمي والاعتماد المباشر من قِبل إدارة الأكاديمية. لا تتيح المنظومة التسجيل الذاتي المفتوح للمدربين دون فحص مسبق، ولا يتم إصدار الحسابات إلا عبر المنصة الإدارية.'
              : 'Instructional appointments at the Egyptian Space Agency Academy are institutional faculty positions subject to administrative review and official accreditation. The system does not support unverified public self-registration for instructors; all instructor accounts are provisioned directly by Academy Administrators.'}
          </span>
        </div>

        {/* Requirements Box */}
        <div className="p-3 mb-4 rounded bg-dark border border-secondary text-secondary small" style={{ lineHeight: '1.6' }}>
          <h4 className="h6 text-white fw-bold mb-2">
            <i className="fa-solid fa-clipboard-check text-info me-2" aria-hidden="true" />
            {isAr ? 'شروط ومتطلبات الاعتماد التدريبي:' : 'Accreditation Prerequisites:'}
          </h4>
          <ul className="mb-0 ps-3">
            <li>{isAr ? 'مؤهل أكاديمي أو هندسي متخصص في علوم وتكنولوجيا الفضاء (دكتوراه، ماجستير، أو خبرة صناعية).' : 'Academic or engineering degree in space systems, aerospace, communications, or orbital mechanics.'}</li>
            <li>{isAr ? 'تقديم السيرة الذاتية وقائمة الأبحاث والمشاريع التطبيقية.' : 'Submission of academic curriculum vitae, research publications, or flight hardware experience.'}</li>
            <li>{isAr ? 'اعتماد المنهج التدريبي من اللجنة العلمية بالأكاديمية.' : 'Syllabus and curriculum evaluation by the Academy Scientific Committee.'}</li>
          </ul>
        </div>

        {/* Administrative Actions */}
        <div className="d-grid gap-2">
          <Button
            type="button"
            className={`btn-egsa ${s.submitBtn}`}
            onClick={handleInstructorAcknowledge}
          >
            <i className="fa-solid fa-arrow-right-to-bracket me-2" aria-hidden="true" />
            <span>{isAr ? 'تسجيل دخول المدربين المعتمدين' : 'Sign In with Accredited Account'}</span>
          </Button>

          <Button
            type="button"
            variant="outline-secondary"
            className="w-100 py-2 mt-1 text-light border-secondary"
            onClick={() => handleSelectRole('student')}
          >
            <i className="fa-solid fa-user-astronaut me-2 text-info" aria-hidden="true" />
            <span>{isAr ? 'التبديل إلى تسجيل حساب متدرب' : 'Switch to Student Cadet Registration'}</span>
          </Button>
        </div>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------
  // Render Step 3: Registration Success / Confirmation Screen
  // -------------------------------------------------------------
  return (
    <AuthShell
      title={isAr ? 'تم استلام البيانات بنجاح' : 'Registration Acknowledged'}
      sub={isAr ? 'مرحباً بك في منظومة وكالة الفضاء المصرية.' : 'Welcome to the Egyptian Space Agency Academy network.'}
      lang={lang}
      setLang={setLang}
      backTo="/"
    >
      <div className="text-center py-2">
        <div className={s.successBadge}>
          <i className="fa-solid fa-circle-check" aria-hidden="true" />
        </div>

        <h3 className="h5 text-white fw-bold mb-2">
          {successInfo?.role === 'instructor'
            ? (isAr ? 'تم إرسال طلب الاعتماد بنجاح' : 'Accreditation Request Submitted')
            : (isAr ? 'تم إنشاء حساب المتدرب بنجاح' : 'Student Account Created')}
        </h3>

        <p className="small text-secondary mb-4 px-2" style={{ lineHeight: '1.6' }}>
          {successInfo?.message}
        </p>

        {successInfo?.email && (
          <div className="p-2 mb-4 rounded bg-dark border border-secondary text-info small">
            <i className="fa-solid fa-envelope me-2" aria-hidden="true" />
            <span>{successInfo.email}</span>
          </div>
        )}

        {/* Prominent Go to Login Action */}
        <Button
          type="button"
          className={`btn-egsa ${s.submitBtn}`}
          onClick={() => {
            navigate('/login', {
              state: {
                email: successInfo?.email,
                message: successInfo?.message,
              },
              replace: true,
            });
          }}
        >
          <i className="fa-solid fa-arrow-right-to-bracket me-2" aria-hidden="true" />
          <span>{isAr ? 'الانتقال إلى صفحة تسجيل الدخول' : 'Go to Login'}</span>
        </Button>
      </div>
    </AuthShell>
  );
}
