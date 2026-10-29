import {useEffect,useRef,useState} from 'react';
import {NavLink,Link} from 'react-router-dom';
import {config} from './config';
import logo from './assets/academy-logo.png';
export const usePageMeta=(title,desc)=>useEffect(()=>{document.title=title?`${title} | Egyptian Space Agency`:'Egyptian Space Agency';
  if(desc){let m=document.querySelector('meta[name=description]');m&&m.setAttribute('content',desc)}window.scrollTo(0,0)},[title,desc]);
export function Reveal({children,className=''}){const r=useRef();const [on,setOn]=useState(false);
  useEffect(()=>{const io=new IntersectionObserver(([e])=>e.isIntersecting&&(setOn(true),io.disconnect()),{threshold:.15});io.observe(r.current);return()=>io.disconnect()},[]);
  return <div ref={r} className={`reveal ${on?'in':''} ${className}`}>{children}</div>}
export function Cta({ to, href, children, variant = 'gold', size = '', className = '', noArrow = false }) {
  const c = `btn ${variant} ${size} ${className}`.trim();
  const cleanChildren = typeof children === 'string' ? children.replace(/[›→▸»\s]+$/, '') : children;
  if (href) {
    return (
      <a className={c} href={href} target="_blank" rel="noopener noreferrer">
        <span>{cleanChildren}</span>
        {!noArrow && (
          <svg className="arrow-diag" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17L17 7M7 7h10v10" />
          </svg>
        )}
      </a>
    );
  }
  return (
    <Link className={c} to={to}>
      <span>{cleanChildren}</span>
      {!noArrow && (
        <svg className="arrow-right" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      )}
    </Link>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className={`hdr ${scrolled ? 'solid' : ''}`}>
      <a className="skip" href="#main">Skip to main content</a>
      <div className="wrap hdr-in">
        <Link to="/" className="brand" onClick={() => setOpen(false)} aria-label="EGSA home">
          <img
            src={logo}
            alt="EGSA Emblem"
            width="40"
            height="40"
            style={{ borderRadius: '6px', background: '#ffffff', padding: '2px', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="wm">EGSA</span>
            <span className="wm2">
              EGYPTIAN SPACE AGENCY
              <small lang="ar" dir="rtl">وكالة الفضاء المصرية</small>
            </span>
          </div>
        </Link>
        <button
          className="burger"
          aria-expanded={open}
          aria-controls="nav"
          aria-label={open ? 'Close main navigation menu' : 'Open main navigation menu'}
          onClick={() => setOpen(!open)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {open ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <path d="M4 12h16M4 6h16M4 18h16" />
            )}
          </svg>
          <span>{open ? 'Close' : 'Menu'}</span>
        </button>
        <nav id="nav" className={open ? 'open' : ''} aria-label="Main navigation">
          {config.nav.map(n => {
            const isTarget = ['/about', '/programs', '/training', '/research', '/news', '/contact'].includes(n.to);
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                title={n.title || n.label}
                aria-label={n.title || n.label}
                className={({ isActive }) => [
                  isTarget ? 'nav-item-white' : '',
                  isActive ? 'active' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => setOpen(false)}
              >
                {n.label}
              </NavLink>
            );
          })}
          <button className="lang" disabled title="Arabic content is not yet available">العربية</button>
          {config.loginUrl ? (
            <a className="btn gold sm" href={config.loginUrl}>Sign In</a>
          ) : localStorage.getItem('egsa_access_token') ? (
            <Link className="btn gold sm" to="/student/dashboard" onClick={() => setOpen(false)}>Academy Portal &rarr;</Link>
          ) : (
            <Link className="btn gold sm" to="/login" onClick={() => setOpen(false)}>Sign In</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
function FtrIconPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function FtrIconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function FtrIconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function FtrIconExt() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function FtrIconArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function FtrIconLinkedIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function FtrIconTwitter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

function FtrIconFacebook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function FtrIconYouTube() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}

function FtrIconGlobe() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="ftr" role="contentinfo">
      <div className="ftr-glow" aria-hidden="true" />
      <div className="ftr-stars" aria-hidden="true" />

      <div className="wrap ftr-main">
        <div className="ftr-grid">
          {/* Section A: Brand and Institutional Introduction */}
          <div className="ftr-brand-col">
            <Link to="/" className="ftr-brand-link" aria-label="Egyptian Space Agency Home">
              <img
                src={logo}
                alt="Egyptian Space Academy logo emblem, powered by Egyptian Space Agency"
                className="ftr-logo-img"
                width="56"
                height="56"
              />
              <div className="ftr-brand-titles">
                <span className="ftr-wm">EGSA</span>
                <span className="ftr-wm2">
                  EGYPTIAN SPACE AGENCY
                  <small lang="ar" dir="rtl">وكالة الفضاء المصرية</small>
                </span>
              </div>
            </Link>

            <p className="ftr-intro">
              The Egyptian Space Agency advances space science and technology, supports research and innovation, and develops national capabilities to contribute to Egypt&apos;s future in space.
            </p>

            <div className="ftr-affiliation-pill">
              <span className="ftr-pill-dot" aria-hidden="true" />
              <span>Public Economic Authority • Law No. 3 of 2018</span>
            </div>

            <div className="ftr-social-row" aria-label="EGSA official channels">
              <a
                href="https://egsa.gov.eg/"
                className="ftr-social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EGSA Official Portal"
                title="EGSA Official Portal"
              >
                <FtrIconGlobe />
              </a>
              <a
                href="https://www.linkedin.com/company/egyptian-space-agency"
                className="ftr-social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EGSA on LinkedIn"
                title="EGSA on LinkedIn"
              >
                <FtrIconLinkedIn />
              </a>
              <a
                href="https://x.com/egspaceagency"
                className="ftr-social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EGSA on X"
                title="EGSA on X"
              >
                <FtrIconTwitter />
              </a>
              <a
                href="https://www.facebook.com/EgyptianSpaceAgency"
                className="ftr-social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EGSA on Facebook"
                title="EGSA on Facebook"
              >
                <FtrIconFacebook />
              </a>
              <a
                href="https://www.youtube.com/@EgyptianSpaceAgency"
                className="ftr-social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="EGSA on YouTube"
                title="EGSA on YouTube"
              >
                <FtrIconYouTube />
              </a>
            </div>
          </div>

          {/* Section B: Quick Navigation */}
          <div className="ftr-col">
            <h2 className="ftr-heading">Quick Navigation</h2>
            <nav aria-label="Footer quick navigation">
              <ul className="ftr-link-list">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/about">About EGSA</Link></li>
                <li><Link to="/programs">Programs</Link></li>
                <li><Link to="/training">Training</Link></li>
                <li><Link to="/research">Research</Link></li>
                <li><Link to="/news">News &amp; Events</Link></li>
                <li><Link to="/contact">Contact Us</Link></li>
              </ul>
            </nav>
          </div>

          {/* Section C: Programs and Academy */}
          <div className="ftr-col">
            <h2 className="ftr-heading">Programs &amp; Academy</h2>
            <nav aria-label="Footer programs navigation">
              <ul className="ftr-link-list">
                <li><Link to="/programs">All Programs</Link></li>
                <li><Link to="/programs/space-fundamentals">Space Fundamentals</Link></li>
                <li><Link to="/training">Training Opportunities</Link></li>
                <li><Link to="/research">Research &amp; Innovation</Link></li>
              </ul>
            </nav>

            <div className="ftr-sub-group">
              <span className="ftr-sub-label">Official Resources</span>
              <ul className="ftr-link-list ftr-ext-list">
                <li>
                  <a href="https://egsa.gov.eg/facilities/labs" target="_blank" rel="noopener noreferrer">
                    <span>Facilities &amp; Labs</span>
                    <FtrIconExt />
                  </a>
                </li>
                <li>
                  <a href="https://egsa.gov.eg/" target="_blank" rel="noopener noreferrer">
                    <span>Official Portal</span>
                    <FtrIconExt />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Section D: Contact Information */}
          <div className="ftr-col ftr-contact-col">
            <h2 className="ftr-heading">Contact Information</h2>

            <address className="ftr-contact-items">
              <div className="ftr-contact-row">
                <span className="ftr-icon-box" aria-hidden="true"><FtrIconPin /></span>
                <span className="ftr-contact-val">Middle Ring road KM, New Cairo, Egypt</span>
              </div>

              <div className="ftr-contact-row">
                <span className="ftr-icon-box" aria-hidden="true"><FtrIconMail /></span>
                <a href="mailto:info@egsa.gov.eg" className="ftr-contact-link">
                  info@egsa.gov.eg
                </a>
              </div>

              <div className="ftr-contact-row">
                <span className="ftr-icon-box" aria-hidden="true"><FtrIconPhone /></span>
                <div className="ftr-phone-lines">
                  <a
                    href="tel:+20221297950"
                    className="ftr-contact-link"
                    aria-label="Call primary phone +20221297950, extension 994"
                  >
                    +20221297950, 994
                  </a>
                  <a
                    href="tel:+20221297993"
                    className="ftr-contact-link"
                    aria-label="Call secondary phone +20221297993"
                  >
                    +20221297993
                  </a>
                </div>
              </div>
            </address>

            <p className="ftr-phone-disclaimer">
              Phone information displayed as supplied; awaiting confirmation.
            </p>
          </div>
        </div>
      </div>

      {/* Section G: Bottom Legal Bar */}
      <div className="ftr-bottom">
        <div className="wrap ftr-bottom-flex">
          <p className="ftr-copyright">
            &copy; {currentYear} Egyptian Space Agency. All rights reserved.
          </p>

          <p className="ftr-legal-notice">
            The Egyptian Space Academy emblem identifies the Academy, powered by EGSA. Imagery is illustrative and awaits approved photography.
          </p>

          <button
            type="button"
            className="ftr-scroll-top"
            onClick={handleScrollTop}
            aria-label="Scroll back to top of page"
          >
            <span>Back to top</span>
            <FtrIconArrowUp />
          </button>
        </div>
      </div>
    </footer>
  );
}
export const PageHero=({title,lead,image,crumb})=><section className="phero" style={{backgroundImage:`linear-gradient(180deg,rgba(6,17,29,.75),rgba(6,17,29,.95)),url(${image})`}}><div className="wrap"><p className="crumb"><Link to="/">Home</Link> / {crumb||title}</p><h1 className="phero-title" style={{ color: '#FFFFFF' }}>{title}</h1>{lead&&<p className="lead">{lead}</p>}</div></section>;
