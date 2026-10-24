import React from 'react';
import { Link } from 'react-router-dom';
import s from './auth.module.css';
import egsaLogo from '../../features/instructor/assets/egsa-logo.png';

export default function AuthShell({
  title,
  sub,
  children,
  isWide = false,
  lang = 'en',
  setLang,
  backTo = '/',
  backLabel,
}) {
  const isAr = lang === 'ar';

  return (
    <div className={s.wrap} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Left Visual Section — Aerospace Identity */}
      <section className={s.hero} aria-label="EGSA Aerospace Identity">
        <div className={s.ambientPattern} aria-hidden="true" />
        <div className={s.orbitalRing} aria-hidden="true" />

        <div className={s.brandCenter}>
          <div className={s.logoPlate}>
            <img src={egsaLogo} alt="EGSA Official Emblem" className={s.agencyLogo} />
          </div>
          <h1 className={s.agencyTitle}>
            {isAr ? 'وكالة الفضاء المصرية' : 'Egyptian Space Agency'}
          </h1>
          <div className={s.academySubtitle}>
            {isAr ? 'أكاديمية الفضاء · البوابة الموحدة' : 'Space Academy • Unified Platform'}
          </div>
        </div>

        <div className={s.visualFooter}>
          <span className={s.statusDot} aria-hidden="true" />
          <span>EGSA // MISSION CONTROL</span>
        </div>
      </section>

      {/* Right Form Section — Clean Authentication Card */}
      <main className={s.panel}>
        <div className={`${s.formCard} ${isWide ? s.formCardWide : ''}`}>
          <div className={s.topBar}>
            {backTo ? (
              <Link to={backTo} className={s.backLink} aria-label={backLabel || (isAr ? 'العودة' : 'Back')}>
                <i className={`fa-solid ${isAr ? 'fa-arrow-right' : 'fa-arrow-left'}`} aria-hidden="true" />
                <span>{backLabel || (isAr ? 'الرئيسية' : 'Home')}</span>
              </Link>
            ) : <div />}

            {setLang && (
              <button
                className={s.langBtn}
                onClick={() => setLang(isAr ? 'en' : 'ar')}
                type="button"
                aria-label={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
              >
                <i className="fa-solid fa-globe" aria-hidden="true" />
                <span>{isAr ? 'English' : 'العربية'}</span>
              </button>
            )}
          </div>

          <div className={s.formHeader}>
            <h2 className={s.formTitle}>{title}</h2>
            {sub && <p className={s.formSubtitle}>{sub}</p>}
          </div>

          {children}

          <div className={s.formFooter}>
            Egyptian Space Agency • Space Academy
          </div>
        </div>
      </main>
    </div>
  );
}
