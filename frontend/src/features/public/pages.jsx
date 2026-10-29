import {useMemo,useState,useEffect} from 'react';
import {Link,useParams,useSearchParams,useNavigate} from 'react-router-dom';
import {config} from './config';
import {vision,mission,quality,programs,news,features,highlights,trainingPillars,researchPillars,pressGuidelines,CATEGORIES,SKINS,getCoursePricing} from './data';
import {usePageMeta,Reveal,Cta,PageHero} from './components.jsx';
import PlanetSystem from './components/PlanetSystem.jsx';
import logo from './assets/academy-logo.png';import earth from './assets/earth-night.png';import sat from './assets/satellite.png';import lab from './assets/lab.png';
const Stars=()=><div className="stars" aria-hidden="true"/>;
const Ic=({children})=><svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="#D4B87C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const icons=[<><path d="M4 18 24 8l20 10-20 10z"/><path d="M12 23v9c4 4 20 4 24 0v-9"/><path d="M44 18v12"/></>,<><path d="M8 40 22 26"/><path d="M14 14c8-4 20 4 20 12"/><path d="M18 18c5-2 10 3 10 8"/><circle cx="36" cy="12" r="2"/></>,<><rect x="19" y="19" width="10" height="10" transform="rotate(45 24 24)"/><path d="M8 20l8-8 4 4-8 8zM28 36l8-8 4 4-8 8z"/></>,<><circle cx="24" cy="12" r="5"/><circle cx="10" cy="26" r="4"/><circle cx="38" cy="26" r="4"/><path d="M14 40c0-8 20-8 20 0M2 40c0-6 8-8 12-6M46 40c0-6-8-8-12-6"/></>];

export function Home() {
  usePageMeta('', "Egyptian Space Agency: advancing space science, technology and innovation.");
  return (
    <>
      <section className="hero" style={{backgroundImage:`linear-gradient(90deg,rgba(6,17,29,.94) 8%,rgba(6,17,29,.35) 62%,rgba(6,17,29,.1)),url(${earth})`}}>
        <Stars/>
        <p className="slogan" aria-hidden="true">Egypt<br/>in space<br/>for a brighter<br/>future</p>
        <div className="wrap">
          <p className="eyebrow h1">Explore • Learn • Build • The Future</p>
          <h1 className="h2" style={{ color: '#FFFFFF' }}>Egyptian Space Agency<span className="gold">Shaping Tomorrow’s Space</span></h1>
          <p className="lead h3">The Egyptian Space Agency (EGSA) is dedicated to advancing space science, technology and innovation, while empowering the next generation of space professionals.</p>
          <div className="row h4">
            <Cta to="/programs" size="lg">Explore Our Programs</Cta>
            <Cta to="/about" variant="ghost" size="lg">Institutional Overview</Cta>
          </div>
        </div>
      </section>
      <section className="dark">
        <div className="wrap strip">
          {features.map((f, i) => (
            <div className="feat" key={f.t}>
              <Ic>{icons[i]}</Ic>
              <h2>{f.t}</h2>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
        <div className="wrap bgrid">
          <Reveal className="bcard mission">
            <div className="mtxt">
              <p className="eyebrow sm">Our mission</p>
              <h2>To position Egypt as a leading space nation in the region</h2>
              <p>By developing human capital, fostering innovation, and enabling sustainable space programs.</p>
              <Cta to="/about" variant="ghost" size="sm">Explore EGSA Mandate</Cta>
            </div>
            <img src={sat} alt="Illustrative satellite above Earth" loading="lazy"/>
          </Reveal>
          <Reveal className="bcard">
            <div className="hl">
              {highlights.map(h => (
                <div key={h.t}>
                  <h3>{h.t}</h3>
                  <p>{h.d}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal className="bcard home-news-card">
            <div className="nh">
              <h2>Latest News &amp; Events</h2>
              <Link to="/news" className="text-link">View Press Center</Link>
            </div>
            {news.length ? (
              news.slice(0, 3).map(n => <p key={n.id}>{n.title}</p>)
            ) : (
              <div className="home-news-notice">
                <div className="home-news-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Verification Policy</span>
                </div>
                <p>This public portal presents only formally verified institutional milestones. Real-time releases and presidential communiqués are maintained on the central government portal.</p>
                <div className="home-news-actions">
                  <Cta href={pressGuidelines.officialPortalNews} variant="ghost" size="sm">Official News Portal</Cta>
                  <Cta to="/news" variant="gold" size="sm">Press Center</Cta>
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* Egyptian Space Academy Spotlight & Course Showcase */}
      <section className="home-academy-section">
        <div className="wrap">
          <div className="home-academy-header">
            <span className="eyebrow gold">SPACE TALENT &amp; ACADEMY</span>
            <h2>Orbital Engineering &amp; Space Science Pathways</h2>
            <p>
              The Egyptian Space Academy delivers hands-on aerospace curricula designed to cultivate sovereign space competencies—from introductory mission fundamentals to operational satellite flight control.
            </p>
          </div>

          <div className="home-courses-grid">
            {programs.filter(p => p.status === 'published').slice(0, 4).map((p) => (
              <Link key={p.slug} to={`/programs/${p.slug}`} className="home-course-card">
                <div className="home-course-planet-row">
                  <div className={`planet sm ${p.planetSkin || 'earth'}`} aria-hidden="true" />
                  <span className="home-course-cat">{p.category}</span>
                </div>
                <h3 className="home-course-title">{p.title}</h3>
                <p className="home-course-tagline">{p.tagline}</p>
                <div className="home-course-footer">
                  <span>{p.duration}</span>
                  <span className="more-link">
                    Explore Course 
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="home-academy-cta-bar">
            <div>
              <p><strong>Ready to chart your journey into space systems?</strong></p>
              <p style={{ fontSize: '0.86rem', margin: '4px 0 0', color: 'var(--muted)' }}>
                Explore all educational and technical pathways with the interactive planetary course map.
              </p>
            </div>
            <Cta to="/programs" size="md">Explore Planetary Course Map</Cta>
          </div>
        </div>
      </section>

      <section className="light">
        <div className="wrap grid2 vm">
          <Reveal>
            <div className="panel vm-panel">
              <div className="vm-header">
                <span className="vm-badge gold">Strategic Outlook</span>
                <h3>Vision</h3>
              </div>
              <p>{vision}</p>
            </div>
          </Reveal>
          <Reveal>
            <div className="panel vm-panel">
              <div className="vm-header">
                <span className="vm-badge teal">National Mandate</span>
                <h3>Mission</h3>
              </div>
              <p>{mission}</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export function About() {
  usePageMeta('About EGSA', 'Establishment, statutory mandate, vision, mission and quality policy of the Egyptian Space Agency.');
  return (
    <>
      <PageHero 
        title="About EGSA" 
        lead="The Arab Republic of Egypt's public economic authority dedicated to sovereign space science, satellite localization, and technological innovation." 
        image={sat}
      />
      
      {/* Executive Overview */}
      <section className="light about-section">
        <div className="wrap">
          <div className="about-overview-grid">
            <div className="about-overview-main">
              <span className="section-eyebrow">FOUNDATIONAL MANDATE • LAW NO. 3 OF 2018</span>
              <h2 className="about-title">Pioneering Egypt’s Sovereign Aerospace Capability</h2>
              <div className="about-lead-text">
                <p>
                  The Egyptian Space Agency (EGSA) was established in August 2019 under <strong>Law No. 3 of 2018</strong> as a public economic authority with independent legal personality, reporting directly to the <strong>President of the Arab Republic of Egypt</strong>.
                </p>
                <p>
                  The statutory purpose of the Agency is to create, transfer, and localize advanced space science and satellite technology, cultivate national engineering talent, and establish the strategic industrial foundation required to design, manufacture, integrate, and launch satellites from Egyptian soil.
                </p>
              </div>
              <div className="about-action-row">
                <Cta to="/programs" variant="navy">Explore Training Programs</Cta>
                <Cta to="/research" variant="teal">Scientific Research Pillars</Cta>
                <Cta to="/contact" variant="ghostDark">Institutional Inquiries</Cta>
              </div>
            </div>

            <div className="about-metrics-column">
              <div className="about-metric-card">
                <div className="about-metric-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div className="about-metric-content">
                  <span className="about-metric-val">August 2019</span>
                  <span className="about-metric-lbl">Formal Establishment &amp; Enactment</span>
                  <p className="about-metric-desc">Established by Presidential Decree pursuant to Law No. 3 of 2018.</p>
                </div>
              </div>

              <div className="about-metric-card">
                <div className="about-metric-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="about-metric-content">
                  <span className="about-metric-val">Public Economic Authority</span>
                  <span className="about-metric-lbl">Independent Legal Personality</span>
                  <p className="about-metric-desc">Direct statutory affiliation with the President of Egypt.</p>
                </div>
              </div>

              <div className="about-metric-card">
                <div className="about-metric-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>
                  </svg>
                </div>
                <div className="about-metric-content">
                  <span className="about-metric-val">AS9100:2016 AQMS</span>
                  <span className="about-metric-lbl">Aerospace Quality Alignment</span>
                  <p className="about-metric-desc">Rigorous international standards governing space engineering operations.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Strategic Foundations: Vision & Mission */}
      <section className="dark about-vm-section">
        <div className="wrap">
          <div className="about-vm-header">
            <span className="section-eyebrow gold">STRATEGIC HORIZONS</span>
            <h2>Vision &amp; Institutional Mission</h2>
            <p className="about-vm-lead">Directing national space endeavors toward peaceful utilization, socio-economic resilience, and scientific leadership.</p>
          </div>

          <div className="about-vm-grid">
            <div className="about-vm-card vision-card">
              <div className="about-vm-card-header">
                <div className="about-vm-icon gold">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="2"/>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                </div>
                <div>
                  <span className="about-vm-tag gold">Long-Term Ambition</span>
                  <h3>Agency Vision</h3>
                </div>
              </div>
              <p className="about-vm-body">{vision}</p>
            </div>

            <div className="about-vm-card mission-card">
              <div className="about-vm-card-header">
                <div className="about-vm-icon teal">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <div>
                  <span className="about-vm-tag teal">Operational Mandate</span>
                  <h3>Agency Mission</h3>
                </div>
              </div>
              <p className="about-vm-body">{mission}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quality Policy Commitments (AQMS AS9100:2016) */}
      <section className="light about-quality-section">
        <div className="wrap">
          <div className="section-header-centered">
            <span className="section-eyebrow">OPERATIONAL EXCELLENCE</span>
            <h2>Aerospace Quality Policy (AQMS AS9100:2016)</h2>
            <p className="section-sub">EGSA operates an Aerospace Quality Management System aligned with AS9100:2016, adhering to international aerospace benchmarks and the following commitments:</p>
          </div>

          <div className="quality-grid">
            {quality.map((q, idx) => (
              <div className="quality-card" key={idx}>
                <div className="quality-card-index">0{idx + 1}</div>
                <p className="quality-card-text">{q}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Institutional Transparency & Governance */}
      <section className="about-gov-section">
        <div className="wrap">
          <div className="about-gov-grid">
            <div className="about-gov-card">
              <div className="about-gov-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <h3>Information Security Governance</h3>
              </div>
              <p>The supplied institutional sources refer to historical ISO/IEC 27001:2013 alignment. In adherence to transparency guidelines, current certificate renewal status and audit scopes are subject to ongoing verification and are not claimed as active certificates here.</p>
            </div>

            <div className="about-gov-card">
              <div className="about-gov-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>Executive Leadership &amp; Governance</h3>
              </div>
              <p>EGSA operates under direct presidential supervision. Leadership mandates and executive board decrees are updated through official gazette publications and the official presidential portal. Unconfirmed names are omitted in accordance with verification policy.</p>
            </div>

            <div className="about-gov-card">
              <div className="about-gov-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                  <path d="M6 6h10M6 10h10"/>
                </svg>
                <h3>Egyptian Space Academy Synergy</h3>
              </div>
              <p>The Egyptian Space Academy operates as the dedicated educational arm of EGSA, translating national aerospace research into applied academic curricula, student workshops, and satellite engineering design challenges.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
export function Programs() {
  usePageMeta('Programs & Space Academy', 'Hands-on space education, satellite engineering methodologies, and planetary pathways from the Egyptian Space Academy.');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';
  const initialQuery = searchParams.get('q') || '';

  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState(initialCategory);
  const [viewMode, setViewMode] = useState('orbits'); // 'orbits' or 'grid'

  const list = programs;
  const categories = CATEGORIES;

  // Sync state if URL search params change
  useEffect(() => {
    const urlCat = searchParams.get('category');
    if (urlCat && categories.includes(urlCat)) {
      setCat(urlCat);
    }
    const urlQ = searchParams.get('q');
    if (urlQ !== null) {
      setQ(urlQ);
    }
  }, [searchParams, categories]);

  const updateFilters = (newCat, newQ) => {
    const nextParams = new URLSearchParams();
    if (newCat && newCat !== 'All') nextParams.set('category', newCat);
    if (newQ && newQ.trim()) nextParams.set('q', newQ.trim());
    setSearchParams(nextParams, { replace: true });
  };

  const handleCategoryChange = (c) => {
    setCat(c);
    updateFilters(c, q);
  };

  const handleSearchChange = (val) => {
    setQ(val);
    updateFilters(cat, val);
  };

  const clearFilter = () => {
    setQ('');
    setCat('All');
    setSearchParams({}, { replace: true });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter(p => {
      const matchCat = cat === 'All' || p.category === cat;
      const matchTerm = !term ||
        p.title.toLowerCase().includes(term) ||
        p.tagline.toLowerCase().includes(term) ||
        (p.summary && p.summary.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term)) ||
        (p.audience && p.audience.some(a => a.toLowerCase().includes(term)));
      return matchCat && matchTerm;
    });
  }, [q, cat, list]);

  return (
    <>
      <section
        className="phero phero-programs"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(6,17,29,0.85) 0%, rgba(6,17,29,0.96) 100%), url(${lab})` }}
      >
        <div className="wrap">
          <p className="crumb"><Link to="/">Home</Link> / Programs &amp; Training</p>
          <div className="phero-badge">
            <span className="badge-dot" aria-hidden="true" />
            <span>Egyptian Space Academy • Academic &amp; Technical Programs</span>
          </div>
          <h1 className="phero-title" style={{ color: '#FFFFFF' }}>Explore Space Programs</h1>
          <p className="lead">
            Comprehensive aerospace curricula formulated by the Egyptian Space Agency—from orbital mechanics and satellite architectures to ground station operations and mission formulation.
          </p>
        </div>
      </section>

      {/* Discovery Controls Bar */}
      <section className="light prog-page-section">
        <div className="wrap">
          <div className="prog-discovery-card">
            <div className="prog-search-box">
              <span className="prog-search-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                id="program-search"
                type="search"
                value={q}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search programs by title, keyword, or audience..."
                aria-label="Search space training programs"
              />
              {q && (
                <button
                  type="button"
                  className="prog-clear-btn"
                  onClick={() => handleSearchChange('')}
                  aria-label="Clear search input"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="prog-filter-pills" role="group" aria-label="Filter programs by category">
              <span className="prog-filter-label">Categories:</span>
              {categories.map(c => {
                const count = c === 'All' ? list.length : list.filter(p => p.category === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`chip ${c === cat ? 'on' : ''}`}
                    aria-pressed={c === cat}
                    onClick={() => handleCategoryChange(c)}
                  >
                    <span>{c === 'All' ? 'All Programs' : c}</span>
                    <span className="chip-count">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results Status & View Switcher Bar */}
          <div className="prog-status-bar">
            <span className="prog-count-text">
              Showing <strong>{filtered.length}</strong> of <strong>{list.length}</strong> available programs
              {cat !== 'All' && <span> in <em>{cat}</em></span>}
              {q.trim() && <span> matching &ldquo;{q.trim()}&rdquo;</span>}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {(q || cat !== 'All') && (
                <button type="button" className="prog-reset-link" onClick={clearFilter}>
                  Clear filters
                </button>
              )}

              {/* View Switcher Toggle */}
              <div className="prog-view-switcher" role="group" aria-label="Course view mode">
                <button
                  type="button"
                  className={`prog-view-btn ${viewMode === 'orbits' ? 'active' : ''}`}
                  onClick={() => setViewMode('orbits')}
                  aria-pressed={viewMode === 'orbits'}
                  title="Planetary Orbit Map view"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
                  </svg>
                  <span>Planetary Orbit View</span>
                </button>
                <button
                  type="button"
                  className={`prog-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  title="Catalog Grid view"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect width="7" height="7" x="3" y="3" rx="1" />
                    <rect width="7" height="7" x="14" y="3" rx="1" />
                    <rect width="7" height="7" x="14" y="14" rx="1" />
                    <rect width="7" height="7" x="3" y="14" rx="1" />
                  </svg>
                  <span>Grid Catalog View</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Planetary Orbit View */}
          {viewMode === 'orbits' && (
            <div className="system-section-wrapper" style={{ borderRadius: '16px', marginBottom: '40px' }}>
              <PlanetSystem items={filtered} />
            </div>
          )}

          {/* Catalog Grid View */}
          {(viewMode === 'grid' || filtered.length > 0) && (
            <>
              {viewMode === 'orbits' && (
                <div style={{ margin: '40px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: '1.4rem', color: 'var(--navy)', margin: 0 }}>
                    Complete Program Directory ({filtered.length})
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                    Select any program for detailed syllabus and application criteria
                  </span>
                </div>
              )}

              {filtered.length > 0 ? (
                <div className="prog-grid">
                  {filtered.map((p, idx) => {
                    const pPricing = getCoursePricing(p);
                    return (
                    <article key={p.slug} className="prog-card" style={{ animationDelay: `${idx * 0.08}s` }}>
                      <div className="prog-card-media">
                        <img src={p.image} alt={p.title} loading="lazy" />
                        <div className={`prog-planet-badge planet sm ${p.planetSkin || 'earth'}`} aria-hidden="true" />
                        <div className="prog-card-badges">
                          <span className={`prog-status-pill ${p.status}`}>
                            <span className="status-dot" aria-hidden="true" />
                            {p.status === 'published' ? 'Official Curriculum' : 'Details Pending'}
                          </span>
                          <span className="prog-cat-pill">{p.category}</span>
                        </div>
                      </div>

                      <div className="prog-card-body">
                        <h2 className="prog-card-title">{p.title}</h2>
                        <p className="prog-card-tagline">{p.tagline}</p>
                        <p className="prog-card-desc">
                          {p.summary || (p.overview && p.overview[0])}
                        </p>

                        <div className="prog-card-meta">
                          <div className="prog-meta-item" title="Program Duration">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            <span>{p.duration}</span>
                          </div>
                          {p.level && (
                            <div className="prog-meta-item" title="Target Level">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                                <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
                              </svg>
                              <span>{p.level}</span>
                            </div>
                          )}
                          <div className="prog-meta-item" title="Target Audience">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                            </svg>
                            <span>{p.audience ? p.audience.slice(0, 2).join(' • ') : ''}</span>
                          </div>
                        </div>

                        {/* Direct Price Area on Course Card */}
                        <div className="prog-card-pricing" aria-label="Course Tuition">
                          <div className="prog-price-pill">
                            <span className="prog-price-tag">Course Fee:</span>
                            <span className={`prog-price-val ${!pPricing.hasPrice ? 'unavailable' : ''}`}>
                              {pPricing.baseFeeText}
                            </span>
                          </div>
                          {pPricing.hasTransportation && (
                            <div className="prog-price-pill transport">
                              <span className="prog-price-tag">With Transport:</span>
                              <span className="prog-price-val">{pPricing.transportFeeText}</span>
                            </div>
                          )}
                        </div>

                        <div className="prog-card-footer">
                          <Link to={`/programs/${p.slug}`} className="btn gold sm">
                            <span>Explore Program</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </Link>
                          <Link to={`/contact?program=${p.slug}`} className="btn ghostDark sm" title={`Inquire about ${p.title}`}>
                            <span>Enquire</span>
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                  })}
                </div>
              ) : (
                <div className="prog-empty-state">
                  <div className="prog-empty-icon" aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4B87C" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                  </div>
                  <h2>No Programs Match Your Search</h2>
                  <p>No educational or technical curricula match &ldquo;{q}&rdquo; in the selected category.</p>
                  <button type="button" className="btn gold sm" onClick={clearFilter}>
                    Reset Search Filters
                  </button>
                </div>
              )}
            </>
          )}

          {/* Educational Progression Roadmap */}
          <div style={{ marginTop: '70px', padding: '36px', background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(6,17,29,0.04)' }}>
            <span className="section-eyebrow">ACADEMIC PATHWAY</span>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--navy)', margin: '6px 0 16px' }}>Progressive Aerospace Engineering Pathways</h2>
            <p style={{ color: '#475569', lineHeight: 1.65, maxWidth: '820px', margin: '0 0 28px' }}>
              The Egyptian Space Academy structures its training programs hierarchically so students and working professionals can advance systematically from basic space physics to complex satellite flight operations.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div style={{ background: '#F8FAFB', padding: '20px', borderRadius: '10px', borderTop: '3px solid #1E7C85' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1E7C85' }}>PHASE 1 • INTRODUCTORY</span>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', margin: '8px 0 6px' }}>Space Fundamentals</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>Foundations of orbital science, solar system exploration, and basic satellite structures.</p>
              </div>
              <div style={{ background: '#F8FAFB', padding: '20px', borderRadius: '10px', borderTop: '3px solid #3A6985' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#3A6985' }}>PHASE 2 • SUBSYSTEMS</span>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', margin: '8px 0 6px' }}>Space Systems &amp; Electronics</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>Bus engineering, EPS, ADCS actuators, thermal design, and circuit board analysis.</p>
              </div>
              <div style={{ background: '#F8FAFB', padding: '20px', borderRadius: '10px', borderTop: '3px solid #D4B87C' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#B39148' }}>PHASE 3 • OPERATIONS &amp; GNSS</span>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', margin: '8px 0 6px' }}>Satellite Ops &amp; Navigation</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>Ground station tracking, telemetry/telecommand loops, GNSS constellations, and cybersecurity.</p>
              </div>
              <div style={{ background: '#F8FAFB', padding: '20px', borderRadius: '10px', borderTop: '3px solid #06111D' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--navy)' }}>PHASE 4 • ADVANCED MISSIONS</span>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', margin: '8px 0 6px' }}>Mission Design &amp; Astrodynamics</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>End-to-end space mission formulation, launch window astrodynamics, and Earth observation analysis.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function ProgramDetail() {
  const { slug } = useParams();
  const p = programs.find(x => x.slug === slug);
  const pPricing = getCoursePricing(p);
  usePageMeta(p ? `${p.title} | Egyptian Space Academy` : 'Program Not Found', p?.tagline);

  if (!p) {
    return (
      <section className="light nf" style={{ padding: '120px 0' }}>
        <div className="wrap text-center">
          <h1>Program Not Found</h1>
          <p className="lead" style={{ margin: '16px auto 32px', maxWidth: '500px' }}>
            No official space curriculum matches the address &ldquo;{slug}&rdquo;.
          </p>
          <Cta to="/programs" variant="navy">Return to Course Catalog</Cta>
        </div>
      </section>
    );
  }

  const related = programs.filter(x => x.slug !== p.slug && x.category === p.category).slice(0, 3);
  const curSkin = p.planetSkin || 'earth';

  return (
    <>
      {/* Dossier Hero */}
      <section className="pdetail-hero">
        <div className="wrap">
          <p className="crumb" style={{ color: 'var(--muted)', marginBottom: '16px' }}>
            <Link to="/" style={{ color: '#fff' }}>Home</Link> / <Link to="/programs" style={{ color: '#fff' }}>Programs</Link> / {p.title}
          </p>

          <div className="pdetail-hero-content">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span className="system-category-pill">{p.category}</span>
                {p.level && <span className="system-level-pill">{p.level}</span>}
                <span className="system-status-indicator">
                  <span className="status-indicator-dot" aria-hidden="true" />
                  {p.status === 'published' ? 'Official Course' : 'Details Pending'}
                </span>
              </div>

              <h1 style={{ color: '#ffffff', margin: '0 0 12px', fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)' }}>
                {p.title}
              </h1>

              <p style={{ color: 'var(--gold)', fontSize: '1.15rem', fontWeight: '500', margin: '0 0 16px', lineHeight: 1.4 }}>
                {p.tagline}
              </p>

              <p style={{ color: 'var(--muted)', fontSize: '0.98rem', maxWidth: '780px', lineHeight: 1.6, margin: 0 }}>
                {p.subtitle}
              </p>

              {/* Metrics Strip */}
              <div className="pdetail-metrics-strip">
                <div className="pdetail-metric-chip">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Duration: <strong>{p.duration}</strong></span>
                </div>
                {p.audience && p.audience.length > 0 && (
                  <div className="pdetail-metric-chip">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    <span>Audience: <strong>{p.audience[0]}</strong></span>
                  </div>
                )}
                {p.certification && (
                  <div className="pdetail-metric-chip">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span>Certificate: <strong>Verified</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* 3D Planet Preview in Hero */}
            <div className={`pdetail-hero-planet planet ${curSkin}`} aria-label={`${p.title} planetary badge`} />
          </div>
        </div>
      </section>

      {/* Main Two-Column Content Layout */}
      <section className="light">
        <div className="wrap pdetail-layout">
          {/* Main Dossier Column */}
          <div className="pdetail-main">
            {p.status === 'draft' && (
              <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '10px', padding: '16px 20px', marginBottom: '28px', color: '#92400E', fontSize: '0.94rem' }}>
                <strong>Institutional Advisory:</strong> This curriculum entry is currently undergoing final verification. The official title, syllabus, laboratory schedule, and learning objectives will be updated upon final clearance.
              </div>
            )}

            {/* Overview */}
            <div className="pdetail-card-section">
              <h2>Program Overview</h2>
              {p.overview && p.overview.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {/* Learning Objectives */}
            {p.objectives && p.objectives.length > 0 && (
              <div className="pdetail-card-section">
                <h2>Learning Objectives</h2>
                <ul className="pdetail-obj-list">
                  {p.objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Curriculum Modules / Days */}
            {p.days && p.days.length > 0 && (
              <div className="pdetail-card-section">
                <h2>Course Curriculum &amp; Modules</h2>
                <p>Structured daily modules combining theoretical physics with applied laboratory workshops:</p>
                <div className="curriculum-timeline">
                  {p.days.map((d, i) => (
                    <div className="curriculum-day" key={d.title || i}>
                      <h3>{d.title}</h3>
                      {d.focus && <p className="curriculum-focus">Module Focus: {d.focus}</p>}
                      {d.items && d.items.length > 0 && (
                        <ul className="curriculum-items">
                          {d.items.map((item, itemIdx) => (
                            <li key={itemIdx}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Training Methodology & Laboratory Tools */}
            {((p.methodology && p.methodology.length > 0) || (p.tools && p.tools.length > 0)) && (
              <div className="pdetail-card-section">
                <h2>Training Methodology &amp; Laboratory Tools</h2>
                {p.methodology && p.methodology.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: '12px 0 8px' }}>Teaching Methods</h3>
                    <ul className="pdetail-method-list">
                      {p.methodology.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
                {p.tools && p.tools.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: '24px 0 8px' }}>Hands-On Equipment &amp; Software</h3>
                    <ul className="pdetail-method-list">
                      {p.tools.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Planned Materials */}
            {p.materials && p.materials.planned && p.materials.planned.length > 0 && (
              <div className="pdetail-card-section">
                <h2>Course Materials &amp; Documentation</h2>
                <p>Official course packages distributed to enrolled participants:</p>
                <ul className="pdetail-method-list">
                  {p.materials.planned.map((mat, i) => (
                    <li key={i}>{mat}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prerequisites & Certification */}
            <div className="pdetail-card-section">
              <h2>Prerequisites &amp; Credentials</h2>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', margin: '10px 0 6px' }}>Prerequisites</h3>
              <p>{p.prerequisites || 'No prior aerospace experience required.'}</p>

              {p.certification && (
                <>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', margin: '18px 0 6px' }}>Certification</h3>
                  <p>{p.certification}</p>
                </>
              )}

              {p.evaluation && p.evaluation.length > 0 && (
                <>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', margin: '18px 0 6px' }}>Evaluation Areas</h3>
                  <p>{p.evaluation.join(' • ')}</p>
                </>
              )}
            </div>
          </div>

          {/* Sticky Sidebar */}
          <aside className="pdetail-sidebar">
            <div className="pdetail-sidebar-card">
              <h3>Program Summary</h3>

              <dl className="pdetail-sidebar-specs">
                <div className="pdetail-sidebar-spec">
                  <dt>Duration</dt>
                  <dd>{p.duration}</dd>
                </div>
                <div className="pdetail-sidebar-spec">
                  <dt>Category</dt>
                  <dd>{p.category}</dd>
                </div>
                <div className="pdetail-sidebar-spec">
                  <dt>Tuition</dt>
                  <dd style={{ color: 'var(--gold)', fontWeight: 600 }}>
                    {pPricing.baseFeeText}
                    {pPricing.hasTransportation && (
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748B', fontWeight: 400 }}>
                        (With Transp: {pPricing.transportFeeText})
                      </span>
                    )}
                  </dd>
                </div>
                <div className="pdetail-sidebar-spec">
                  <dt>Format</dt>
                  <dd>On-site Labs &amp; Hybrid</dd>
                </div>
                <div className="pdetail-sidebar-spec">
                  <dt>Language</dt>
                  <dd>English (Arabic Support)</dd>
                </div>
                <div className="pdetail-sidebar-spec">
                  <dt>Status</dt>
                  <dd style={{ color: p.status === 'published' ? '#16A34A' : '#D97706' }}>
                    {p.status === 'published' ? 'Active Curriculum' : 'Pending Clearance'}
                  </dd>
                </div>
              </dl>

              <div className="pdetail-sidebar-actions">
                <Cta to={`/contact?program=${p.slug}`} size="md">
                  Enquire About This Program
                </Cta>
                {config.academyPortalUrl ? (
                  <Cta href={config.academyPortalUrl} variant="ghostDark" size="md">
                    Academy Portal Access
                  </Cta>
                ) : (
                  <Cta to="/login" variant="ghostDark" size="md">
                    Sign In
                  </Cta>
                )}
                <Link to="/programs" className="btn ghostDark sm" style={{ marginTop: '8px' }}>
                  ← All Programs
                </Link>
              </div>

              {/* Related Programs in Category */}
              {related.length > 0 && (
                <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--navy)', margin: '0 0 12px' }}>
                    Related {p.category} Courses
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
                    {related.map(r => (
                      <li key={r.slug}>
                        <Link
                          to={`/programs/${r.slug}`}
                          style={{
                            fontSize: '0.86rem',
                            color: 'var(--teal)',
                            fontWeight: '600',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>{r.title}</span>
                          <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>{r.duration}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Institutional Notice */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #F1F5F9', fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5 }}>
                Administered by the Egyptian Space Academy under the Egyptian Space Agency (Law No. 3 of 2018).
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
export function News() {
  usePageMeta('Press & Media Center', 'Official announcements, institutional verification policy, and media resources from the Egyptian Space Agency.');
  return (
    <>
      <PageHero 
        title="Press & Media Center" 
        lead="Authoritative announcements, official communiqués, and verified media resources from the Egyptian Space Agency." 
        image={earth}
      />

      {/* Press Verification Policy & Official Portal Gateway */}
      <section className="light news-center-section">
        <div className="wrap">
          <div className="news-policy-card">
            <div className="news-policy-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Institutional Information Integrity Policy</span>
            </div>
            <h2>Rigorous Verification Standards Under Law No. 3 of 2018</h2>
            <p className="news-policy-text">{pressGuidelines.policy}</p>
            <p className="news-policy-sub">
              To prevent the dissemination of unverified technical data or speculative announcements, this public information platform maintains an authentic, zero-speculation publication record. Full press statements, launch ceremonies, and presidential communiqués are cataloged on the primary government media portal.
            </p>
          </div>

          <div className="news-hub-grid">
            {/* Main Gateway to Official News */}
            <div className="news-gateway-card">
              <div className="news-gateway-badge">Primary Media Gateway</div>
              <h3>Official EGSA News Portal &amp; Press Archive</h3>
              <p>
                Browse the complete archive of official press statements, executive presidential appointments, bilateral space agency accords, and technological milestones directly on the central agency portal.
              </p>
              <ul className="news-topics-list">
                <li>Executive leadership announcements &amp; legislative decrees</li>
                <li>Sovereign satellite launches &amp; orbital telemetry milestones</li>
                <li>International bilateral treaties &amp; space agency cooperation</li>
                <li>Egyptian Space City infrastructure &amp; AIT facility progress</li>
                <li>Egyptian Space Academy workshops &amp; STEM symposiums</li>
              </ul>
              <div className="news-gateway-actions">
                <Cta href={pressGuidelines.officialPortalNews} variant="gold" size="lg">Open Official EGSA News Portal</Cta>
              </div>
            </div>

            {/* Media Relations & Press Desk */}
            <div className="news-media-desk-card">
              <div className="news-desk-header">
                <span className="section-eyebrow">PRESS RELATIONS</span>
                <h3>Media Communications Desk</h3>
                <p>Dedicated channels for accredited journalists, broadcast media, and institutional research correspondents.</p>
              </div>

              <div className="news-desk-box">
                <h4>Press Inquiries &amp; Accreditation</h4>
                <p>To request official quotes, technical briefings, or media accreditation for agency events:</p>
                <Cta to="/contact?subject=Press%20and%20Media%20Inquiry" variant="teal" size="sm">Submit Media Request</Cta>
              </div>

              <div className="news-desk-box">
                <h4>Direct Press Office Email</h4>
                <p>Institutional press releases and media kits are coordinated directly via:</p>
                <a href={`mailto:${pressGuidelines.mediaEmail}`} className="btn ghost sm news-email-btn">
                  <span>{pressGuidelines.mediaEmail}</span>
                  <svg className="arrow-right" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
const emptyForm = { name: '', email: '', phone: '', subject: '', message: '', consent: false };

export function Contact() {
  usePageMeta('Contact Us', 'Reach the Egyptian Space Agency and the Egyptian Space Academy for institutional inquiries and program admissions.');
  const [searchParams, setSearchParams] = useSearchParams();
  const programSlug = searchParams.get('program');

  const matchedProgram = useMemo(() => {
    return programSlug ? programs.find(p => p.slug === programSlug) : null;
  }, [programSlug]);

  const [form, setForm] = useState(() => ({
    ...emptyForm,
    subject: matchedProgram ? `Inquiry regarding ${matchedProgram.title}` : ''
  }));

  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Update subject if URL program param changes
  useEffect(() => {
    if (matchedProgram) {
      setForm(prev => ({
        ...prev,
        subject: prev.subject && !prev.subject.startsWith('Inquiry regarding')
          ? prev.subject
          : `Inquiry regarding ${matchedProgram.title}`
      }));
    }
  }, [matchedProgram]);

  const handleChange = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, form[field]);
  };

  const validateField = (field, val) => {
    let err = '';
    if (field === 'name') {
      if (!val || !val.trim()) err = 'Please enter your full name.';
      else if (val.trim().length < 2) err = 'Full name must be at least 2 characters.';
    } else if (field === 'email') {
      if (!val || !val.trim()) err = 'Please enter your email address.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) err = 'Please enter a valid email address (e.g., name@domain.eg).';
    } else if (field === 'phone') {
      if (val && val.trim() && !/^[+0-9\s\-()]{7,25}$/.test(val.trim())) {
        err = 'Please enter a valid telephone number format.';
      }
    } else if (field === 'subject') {
      if (!val || !val.trim()) err = 'Please provide an inquiry subject.';
      else if (val.trim().length < 3) err = 'Subject must be at least 3 characters.';
    } else if (field === 'message') {
      if (!val || !val.trim()) err = 'Please write your message or inquiry.';
      else if (val.trim().length < 10) err = 'Message should be at least 10 characters for clarity.';
      else if (val.length > 1200) err = 'Message exceeds maximum length of 1,200 characters.';
    } else if (field === 'consent') {
      if (!val) err = 'Consent is required to submit this institutional inquiry.';
    }

    setErrors(prev => {
      const updated = { ...prev };
      if (err) updated[field] = err;
      else delete updated[field];
      return updated;
    });
    return !err;
  };

  const validateAll = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Please enter your full name.';
    else if (form.name.trim().length < 2) newErrors.name = 'Full name must be at least 2 characters.';

    if (!form.email.trim()) newErrors.email = 'Please enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) newErrors.email = 'Please enter a valid email address.';

    if (form.phone && form.phone.trim() && !/^[+0-9\s\-()]{7,25}$/.test(form.phone.trim())) {
      newErrors.phone = 'Please enter a valid telephone number format.';
    }

    if (!form.subject.trim()) newErrors.subject = 'Please provide an inquiry subject.';
    else if (form.subject.trim().length < 3) newErrors.subject = 'Subject must be at least 3 characters.';

    if (!form.message.trim()) newErrors.message = 'Please enter your message.';
    else if (form.message.trim().length < 10) newErrors.message = 'Message should be at least 10 characters for clarity.';
    else if (form.message.length > 1200) newErrors.message = 'Message exceeds maximum length of 1,200 characters.';

    if (!form.consent) newErrors.consent = 'Consent is required to submit this institutional inquiry.';

    setErrors(newErrors);
    setTouched({
      name: true,
      email: true,
      phone: true,
      subject: true,
      message: true,
      consent: true
    });
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status.state === 'loading') return;

    const isValid = validateAll();
    if (!isValid) {
      const firstErrorElem = document.querySelector('.contact-field [aria-invalid="true"]');
      if (firstErrorElem) firstErrorElem.focus();
      return;
    }

    // Check if real contact endpoint is configured
    if (!config.contactEndpoint) {
      setStatus({
        state: 'unconfigured',
        message: 'Endpoint unconfigured in this environment. Direct email submission is prepared below.'
      });
      return;
    }

    setStatus({ state: 'loading', message: 'Transmitting inquiry to Egyptian Space Agency...' });

    try {
      const response = await fetch(config.contactEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone ? form.phone.trim() : undefined,
          subject: form.subject.trim(),
          message: form.message.trim(),
          programInquired: matchedProgram ? matchedProgram.slug : undefined,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      setStatus({
        state: 'sent',
        message: 'Your inquiry has been successfully transmitted to the Egyptian Space Agency communications office.'
      });
      setForm(emptyForm);
      setTouched({});
      setErrors({});
    } catch (err) {
      setStatus({
        state: 'failed',
        message: 'The inquiry could not be sent due to a network or server communication error. Your input has been preserved.'
      });
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard?.writeText(config.contact.address).then(() => {
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2400);
    });
  };

  const clearProgramContext = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('program');
    setSearchParams(nextParams);
    setForm(prev => ({
      ...prev,
      subject: prev.subject.startsWith('Inquiry regarding') ? '' : prev.subject
    }));
  };

  const c = config.contact;
  const mailtoBody = encodeURIComponent(
    `Name: ${form.name || '(Not provided)'}\n` +
    `Email: ${form.email || '(Not provided)'}\n` +
    `Phone: ${form.phone || '(Not provided)'}\n` +
    (matchedProgram ? `Inquiring about program: ${matchedProgram.title}\n` : '') +
    `\n--- Message ---\n${form.message || ''}`
  );
  const mailtoUrl = `mailto:${c.email}?subject=${encodeURIComponent(form.subject || 'Inquiry - Egyptian Space Agency')}&body=${mailtoBody}`;

  return (
    <>
      <section
        className="phero phero-contact"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(6,17,29,0.85) 0%, rgba(6,17,29,0.96) 100%), url(${earth})` }}
      >
        <div className="wrap">
          <p className="crumb"><Link to="/">Home</Link> / Contact Us</p>
          <div className="phero-badge">
            <span className="badge-dot" aria-hidden="true" />
            <span>Official Institutional Communications • Cairo, Egypt</span>
          </div>
          <h1 className="phero-title" style={{ color: '#FFFFFF' }}>Contact Egyptian Space Agency</h1>
          <p className="lead">
            Connect with our administrative headquarters, academic coordinators, and technical departments for program inquiries, institutional partnerships, or general questions.
          </p>
        </div>
      </section>

      <section className="light contact-page-section">
        <div className="wrap">
          <div className="contact-grid">
            {/* Left Column: Institutional Information Cards */}
            <aside className="contact-info-col" aria-label="Official Contact Information">
              <div className="contact-info-header">
                <span className="contact-subhead">Headquarters &amp; Directory</span>
                <h2>Official Space Agency Registry</h2>
                <p>
                  The Egyptian Space Agency is a public economic authority headquartered in New Cairo, affiliated with the Presidency of the Arab Republic of Egypt.
                </p>
              </div>

              {/* Card 1: Physical Headquarters */}
              <div className="contact-card">
                <div className="contact-card-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div className="contact-card-content">
                  <h3>Agency Headquarters</h3>
                  <p className="contact-card-text">
                    <strong>{c.org}</strong>
                    <br />
                    {c.address}
                  </p>
                  <div className="contact-card-actions">
                    <button
                      type="button"
                      className="contact-action-btn"
                      onClick={handleCopyAddress}
                      aria-label="Copy official agency address to clipboard"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                      <span>{copiedAddr ? 'Address Copied!' : 'Copy Address'}</span>
                    </button>
                    <a
                      href="https://maps.google.com/?q=Egyptian+Space+Agency+New+Cairo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-action-link"
                      title="Open location in Google Maps (external)"
                    >
                      <span>View Map</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M15 3h6v6" />
                        <path d="M10 14 21 3" />
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Card 2: Electronic Inquiries */}
              <div className="contact-card">
                <div className="contact-card-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div className="contact-card-content">
                  <h3>Direct Electronic Mail</h3>
                  <p className="contact-card-desc">
                    For public relations, educational inquiries, and institutional correspondence:
                  </p>
                  <a href={`mailto:${c.email}`} className="contact-direct-link">
                    {c.email}
                  </a>
                  <span className="contact-hint-text">Official agency response window: 2–3 business days.</span>
                </div>
              </div>

              {/* Card 3: Telecommunications */}
              <div className="contact-card">
                <div className="contact-card-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div className="contact-card-content">
                  <h3>Official Telephone Lines</h3>
                  <div className="contact-phone-list">
                    {c.phones.map((phoneStr) => {
                      const dialNumber = phoneStr.split(',')[0].replace(/[\s-]/g, '');
                      return (
                        <div key={phoneStr} className="contact-phone-item">
                          <a href={`tel:${dialNumber}`} className="contact-direct-link">
                            {phoneStr}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                  <p className="contact-disclaimer">
                    Phone numbers are presented exactly as officially supplied; please confirm switchboard extension with the operator.
                  </p>
                </div>
              </div>

              {/* Card 4: Operating Hours & Working Days */}
              <div className="contact-card">
                <div className="contact-card-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="contact-card-content">
                  <h3>Official Operating Hours</h3>
                  <p className="contact-card-text">
                    <strong>Sunday – Thursday:</strong> 8:30 AM – 3:30 PM (Cairo Time / EET)
                    <br />
                    <strong>Friday – Saturday:</strong> Closed (Official Weekend)
                  </p>
                  <span className="contact-hint-text">Online inquiries and email messages may be submitted at all times.</span>
                </div>
              </div>
            </aside>

            {/* Right Column: Premium Contact & Inquiry Form */}
            <main className="contact-form-col">
              <div className="contact-form-card">
                <div className="contact-form-header">
                  <span className="contact-badge">Communications Desk</span>
                  <h2>Send an Institutional Inquiry</h2>
                  <p>
                    Submit your academic inquiry, research question, or collaboration proposal directly to EGSA administrators.
                  </p>
                </div>

                {/* Optional Program Context Notification */}
                {matchedProgram && (
                  <div className="program-context-banner" role="status">
                    <div className="program-context-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                        <path d="M6 6h10M6 10h10" />
                      </svg>
                    </div>
                    <div className="program-context-text">
                      <span>Inquiring about curriculum:</span>
                      <strong>{matchedProgram.title}</strong>
                    </div>
                    <button
                      type="button"
                      className="program-context-clear"
                      onClick={clearProgramContext}
                      title="Clear program inquiry context"
                      aria-label="Clear program inquiry context"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Form Submission Confirmation / Result States */}
                {status.state === 'sent' ? (
                  <div className="form-feedback-card success" role="alert">
                    <div className="feedback-icon" aria-hidden="true">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1E7C85" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <h3>Inquiry Transmitted Successfully</h3>
                    <p>{status.message}</p>
                    <p className="feedback-sub">
                      An agency representative will review your message during official operating hours.
                    </p>
                    <button
                      type="button"
                      className="btn navy sm"
                      onClick={() => setStatus({ state: 'idle', message: '' })}
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate className="contact-form" aria-label="EGSA Contact Form">
                    {/* Unconfigured API Notice with Honest Direct Mailto Trigger */}
                    {status.state === 'unconfigured' && (
                      <div className="form-feedback-card notice" role="alert">
                        <div className="feedback-header">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4B87C" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <h4>Institutional Demonstration Mode</h4>
                        </div>
                        <p>
                          A remote backend submission endpoint (<code>VITE_CONTACT_ENDPOINT</code>) is not currently configured for this deployment.
                        </p>
                        <p>
                          Your entered inquiry data has been formatted. You can dispatch it directly to <strong>{c.email}</strong> via your default email client:
                        </p>
                        <div className="feedback-actions">
                          <a href={mailtoUrl} className="btn gold sm">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <rect width="20" height="16" x="2" y="4" rx="2" />
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                            <span>Open in Email Client</span>
                          </a>
                          <button
                            type="button"
                            className="btn ghostDark sm"
                            onClick={() => {
                              navigator.clipboard?.writeText(decodeURIComponent(mailtoBody));
                              alert('Message text copied to clipboard!');
                            }}
                          >
                            Copy Formatted Message
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Network/Server Failure Notice */}
                    {status.state === 'failed' && (
                      <div className="form-feedback-card error" role="alert">
                        <div className="feedback-header">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                          <h4>Submission Error</h4>
                        </div>
                        <p>{status.message}</p>
                        <p>
                          You can also reach us directly via <a href={`mailto:${c.email}`}>{c.email}</a>.
                        </p>
                      </div>
                    )}

                    {/* Name & Email Row */}
                    <div className="form-row-2">
                      <div className={`contact-field ${errors.name && touched.name ? 'has-error' : ''}`}>
                        <label htmlFor="contact-name">
                          Full Name <span className="req-star" aria-hidden="true">*</span>
                          <span className="sr-only">(required)</span>
                        </label>
                        <input
                          id="contact-name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          placeholder="e.g. Dr. Ahmed Mansour"
                          value={form.name}
                          onChange={handleChange('name')}
                          onBlur={handleBlur('name')}
                          aria-required="true"
                          aria-invalid={!!(errors.name && touched.name)}
                          aria-describedby={errors.name && touched.name ? 'contact-name-err' : undefined}
                          disabled={status.state === 'loading'}
                        />
                        {errors.name && touched.name && (
                          <span id="contact-name-err" className="field-err" role="alert">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {errors.name}
                          </span>
                        )}
                      </div>

                      <div className={`contact-field ${errors.email && touched.email ? 'has-error' : ''}`}>
                        <label htmlFor="contact-email">
                          Email Address <span className="req-star" aria-hidden="true">*</span>
                          <span className="sr-only">(required)</span>
                        </label>
                        <input
                          id="contact-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="name@organization.eg"
                          value={form.email}
                          onChange={handleChange('email')}
                          onBlur={handleBlur('email')}
                          aria-required="true"
                          aria-invalid={!!(errors.email && touched.email)}
                          aria-describedby={errors.email && touched.email ? 'contact-email-err' : undefined}
                          disabled={status.state === 'loading'}
                        />
                        {errors.email && touched.email && (
                          <span id="contact-email-err" className="field-err" role="alert">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {errors.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Phone & Subject Row */}
                    <div className="form-row-2">
                      <div className={`contact-field ${errors.phone && touched.phone ? 'has-error' : ''}`}>
                        <label htmlFor="contact-phone">
                          Telephone Number <span className="opt-label">(optional)</span>
                        </label>
                        <input
                          id="contact-phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="+20 1XX XXX XXXX"
                          value={form.phone}
                          onChange={handleChange('phone')}
                          onBlur={handleBlur('phone')}
                          aria-invalid={!!(errors.phone && touched.phone)}
                          aria-describedby={errors.phone && touched.phone ? 'contact-phone-err' : undefined}
                          disabled={status.state === 'loading'}
                        />
                        {errors.phone && touched.phone && (
                          <span id="contact-phone-err" className="field-err" role="alert">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {errors.phone}
                          </span>
                        )}
                      </div>

                      <div className={`contact-field ${errors.subject && touched.subject ? 'has-error' : ''}`}>
                        <label htmlFor="contact-subject">
                          Subject <span className="req-star" aria-hidden="true">*</span>
                          <span className="sr-only">(required)</span>
                        </label>
                        <input
                          id="contact-subject"
                          name="subject"
                          type="text"
                          placeholder="e.g. Program Enrollment Information"
                          value={form.subject}
                          onChange={handleChange('subject')}
                          onBlur={handleBlur('subject')}
                          aria-required="true"
                          aria-invalid={!!(errors.subject && touched.subject)}
                          aria-describedby={errors.subject && touched.subject ? 'contact-subject-err' : undefined}
                          disabled={status.state === 'loading'}
                        />
                        {errors.subject && touched.subject && (
                          <span id="contact-subject-err" className="field-err" role="alert">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {errors.subject}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message Area with Character Count */}
                    <div className={`contact-field ${errors.message && touched.message ? 'has-error' : ''}`}>
                      <div className="field-label-row">
                        <label htmlFor="contact-message">
                          Inquiry Details / Message <span className="req-star" aria-hidden="true">*</span>
                          <span className="sr-only">(required)</span>
                        </label>
                        <span className={`char-counter ${form.message.length > 1100 ? 'warn' : ''}`}>
                          {form.message.length} / 1200
                        </span>
                      </div>
                      <textarea
                        id="contact-message"
                        name="message"
                        rows="5"
                        placeholder="Please elaborate on your educational background, inquiry objectives, or organization details..."
                        value={form.message}
                        onChange={handleChange('message')}
                        onBlur={handleBlur('message')}
                        maxLength={1200}
                        aria-required="true"
                        aria-invalid={!!(errors.message && touched.message)}
                        aria-describedby={errors.message && touched.message ? 'contact-message-err' : undefined}
                        disabled={status.state === 'loading'}
                      />
                      {errors.message && touched.message && (
                        <span id="contact-message-err" className="field-err" role="alert">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {errors.message}
                        </span>
                      )}
                    </div>

                    {/* Privacy & Consent Checkbox */}
                    <div className={`contact-field-checkbox ${errors.consent && touched.consent ? 'has-error' : ''}`}>
                      <label className="checkbox-container" htmlFor="contact-consent">
                        <input
                          id="contact-consent"
                          name="consent"
                          type="checkbox"
                          checked={form.consent}
                          onChange={handleChange('consent')}
                          onBlur={handleBlur('consent')}
                          aria-required="true"
                          aria-invalid={!!(errors.consent && touched.consent)}
                          aria-describedby={errors.consent && touched.consent ? 'contact-consent-err' : undefined}
                          disabled={status.state === 'loading'}
                        />
                        <span className="checkbox-checkmark" aria-hidden="true" />
                        <span className="checkbox-text">
                          I consent to the Egyptian Space Agency collecting and processing my submitted details in accordance with institutional communications and privacy regulations.
                        </span>
                      </label>
                      {errors.consent && touched.consent && (
                        <span id="contact-consent-err" className="field-err" role="alert">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {errors.consent}
                        </span>
                      )}
                    </div>

                    {/* Submit Actions */}
                    <div className="form-submit-row">
                      <button
                        type="submit"
                        className="btn gold contact-submit-btn"
                        disabled={status.state === 'loading'}
                      >
                        {status.state === 'loading' ? (
                          <>
                            <span className="btn-spinner" aria-hidden="true" />
                            <span>Transmitting Inquiry…</span>
                          </>
                        ) : (
                          <>
                            <span>Transmit Inquiry</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <line x1="22" y1="2" x2="11" y2="13" />
                              <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                          </>
                        )}
                      </button>
                      <span className="submit-security-note">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" aria-hidden="true">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>Encrypted SSL Institutional Transmission</span>
                      </span>
                    </div>
                  </form>
                )}
              </div>
            </main>
          </div>
        </div>
      </section>
    </>
  );
}
export const NotFound=()=>{usePageMeta('Page not found');return <section className="hero short" style={{backgroundImage:`linear-gradient(rgba(6,17,29,.8),rgba(6,17,29,.9)),url(${earth})`}}><div className="wrap"><h1 style={{ color: '#FFFFFF' }}>Page not found</h1><p className="lead">This address does not lead anywhere in the Egyptian Space Agency site.</p><Cta to="/">Return home</Cta></div></section>};

export function Training() {
  usePageMeta('Training & Space Academy', 'Hands-on aerospace education, satellite engineering methodologies, and academic programs at the Egyptian Space Academy.');
  return (
    <>
      <PageHero 
        title="Training & Education" 
        lead="The Egyptian Space Academy — Cultivating sovereign aerospace expertise and empowering the next generation of space engineers." 
        image={lab}
      />

      {/* Academy Overview Split */}
      <section className="light training-intro-section">
        <div className="wrap">
          <div className="training-hero-split">
            <div className="training-intro-text">
              <span className="section-eyebrow">HUMAN CAPITAL DEVELOPMENT</span>
              <h2 className="training-intro-heading">Learning by Doing: Hands-on Space Technology</h2>
              <p className="training-lead">
                The Egyptian Space Academy, powered by the Egyptian Space Agency, delivers comprehensive educational programs designed to bridge theoretical physics and practical aerospace engineering.
              </p>
              <p>
                Training at the Academy is structured around interactive lectures, visual orbital simulations, laboratory hardware demonstrations, collaborative subsystem challenges, and mission design exercises.
              </p>
              <div className="training-stats-row">
                <div className="training-stat-badge">
                  <strong>Practical Lab Focus</strong>
                  <span>Satellite mockups &amp; kits</span>
                </div>
                <div className="training-stat-badge">
                  <strong>Inclusive Pathways</strong>
                  <span>No prior experience for fundamentals</span>
                </div>
                <div className="training-stat-badge">
                  <strong>Team Engineering</strong>
                  <span>Mission trade studies</span>
                </div>
              </div>
              <div className="training-action-row">
                <Cta to="/programs" variant="navy">Browse Programs Catalog</Cta>
                <Cta to="/contact?subject=Academy%20Training%20Inquiry" variant="ghostDark">Inquire About Training</Cta>
              </div>
            </div>

            <div className="training-emblem-card">
              <div className="training-emblem-badge">Official Academy Identity</div>
              <img className="training-logo-img" src={logo} alt="Egyptian Space Academy Official Emblem" width="220" height="220" />
              <h3>The Egyptian Space Academy</h3>
              <p>Powered by the Egyptian Space Agency</p>
              <div className="training-emblem-notice">
                <span>Enacted to cultivate Egypt's future space scientists, engineers, and mission operators.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Training Pillars */}
      <section className="dark training-pillars-section">
        <div className="wrap">
          <div className="section-header-centered">
            <span className="section-eyebrow gold">EDUCATIONAL METHODOLOGY</span>
            <h2>Core Pillars of Space Training</h2>
            <p className="section-sub text-white-muted">A structured pedagogic framework connecting foundational aerospace science to practical laboratory application.</p>
          </div>

          <div className="training-pillars-grid">
            {trainingPillars.map((p, idx) => (
              <div className="training-pillar-card" key={p.title}>
                <div className="training-pillar-num">0{idx + 1}</div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Active Curricula Showcase */}
      <section className="light curricula-section">
        <div className="wrap">
          <div className="section-header-centered">
            <span className="section-eyebrow">CURRICULAR OFFERINGS</span>
            <h2>Current Training Programs</h2>
            <p className="section-sub">Authentic curricula currently documented within the Egyptian Space Academy framework.</p>
          </div>

          <div className="curricula-grid">
            {/* Space Fundamentals */}
            <div className="curriculum-featured-card">
              <div className="curriculum-badge-row">
                <span className="curriculum-status published">Confirmed Curriculum</span>
                <span className="curriculum-duration">2-Day Intensive Track</span>
              </div>
              <h3 className="curriculum-title">Space Fundamentals</h3>
              <p className="curriculum-tagline">Explore the Foundations of Space Science and Technology</p>
              <p className="curriculum-desc">
                An intensive 2-day introductory curriculum introducing participants to orbital mechanics, space mission design, satellite subsystems (EPS, ADCS, communications, payload), and space environmental challenges through interactive lectures and practical engineering demonstrations.
              </p>
              
              <div className="curriculum-detail-block">
                <h4>Intended Audience</h4>
                <div className="curriculum-tags">
                  <span className="curriculum-tag">School students</span>
                  <span className="curriculum-tag">Early university students</span>
                  <span className="curriculum-tag">STEM enthusiasts</span>
                  <span className="curriculum-tag">Beginners</span>
                </div>
              </div>

              <div className="curriculum-card-actions">
                <Cta to="/programs/space-fundamentals" variant="navy" size="sm">View Full Syllabus &amp; Schedule</Cta>
                <Cta to="/contact?program=space-fundamentals" variant="ghostDark" size="sm">Inquire for Next Cohort</Cta>
              </div>
            </div>

            {/* Electronics Training (Draft confirmation) */}
            <div className="curriculum-featured-card pending">
              <div className="curriculum-badge-row">
                <span className="curriculum-status draft">Draft — Pending Confirmation</span>
                <span className="curriculum-duration">3 Days (4–5 hrs/day)</span>
              </div>
              <h3 className="curriculum-title">Electronics Training: Circuit Analysis</h3>
              <p className="curriculum-tagline">Foundational Hardware Principles for STEM Learners</p>
              <p className="curriculum-desc">
                Hands-on laboratory training covering foundational circuit analysis in preparation for circuit design, PCB layouts, and embedded aerospace electronic systems. Official title, detailed syllabus, and schedule are awaiting final institutional confirmation.
              </p>

              <div className="curriculum-detail-block">
                <h4>Recommended Background</h4>
                <p className="curriculum-prereq">Basic electronics knowledge; completion of Electronics Fundamentals is recommended.</p>
              </div>

              <div className="curriculum-card-actions">
                <Cta to="/contact?program=electronics-training-pending" variant="ghostDark" size="sm">Register Advance Interest</Cta>
                <Cta to="/programs" variant="teal" size="sm">View in Program Catalog</Cta>
              </div>
            </div>
          </div>

          {/* Specialized Programs Strip */}
          <div style={{ marginTop: '50px', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--navy)', marginBottom: '8px' }}>
              Advanced Engineering &amp; Technology Modules
            </h3>
            <p style={{ color: '#475569', fontSize: '0.94rem', marginBottom: '24px' }}>
              Specialized professional tracks in satellite bus engineering, mission operations, Earth observation, and navigation:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {programs.filter(p => p.status === 'published' && p.category !== 'Introductory').map(p => (
                <Link
                  key={p.slug}
                  to={`/programs/${p.slug}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(6,17,29,0.04)',
                    transition: 'all 0.2s ease'
                  }}
                  className="training-spec-card"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--teal)', textTransform: 'uppercase' }}>{p.category}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{p.duration}</span>
                  </div>
                  <strong style={{ fontSize: '1.02rem', color: 'var(--navy)' }}>{p.title}</strong>
                  <span style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.4 }}>{p.tagline}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--teal)', fontWeight: '600', marginTop: '4px' }}>
                    View Syllabus &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Admissions Advisory Box */}
          <div className="admissions-advisory-card">
            <div className="admissions-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <div className="admissions-content">
              <h4>Admissions &amp; Cohort Scheduling Advisory</h4>
              <p>
                Specific cohort dates, seating capacities, and enrollment fees are determined per academic cycle and published exclusively upon official release. Educational institutions and interested participants are invited to submit expressions of interest through the official admissions contact desk.
              </p>
            </div>
            <Cta to="/contact" variant="navy" size="sm">Contact Admissions</Cta>
          </div>
        </div>
      </section>
    </>
  );
}

export function Research() {
  usePageMeta('Research & Innovation', 'Building national aerospace capability, satellite technology transfer, and peaceful space exploration.');
  return (
    <>
      <PageHero 
        title="Research & Innovation" 
        lead="Building sovereign national capability in space science, satellite localization, and peaceful space exploration under Law No. 3 of 2018." 
        image={earth}
      />

      {/* Strategic Scientific Mandate */}
      <section className="light research-intro-section">
        <div className="wrap">
          <div className="research-intro-split">
            <div className="research-intro-text">
              <span className="section-eyebrow">STATUTORY RESEARCH MANDATE</span>
              <h2 className="research-intro-heading">Engineering Egypt’s Technological Sovereignty in Space</h2>
              <p className="research-lead">
                In accordance with its legislative mandate under Law No. 3 of 2018, the Egyptian Space Agency conducts and coordinates advanced applied scientific research to establish end-to-end national space technology capabilities.
              </p>
              <p>
                Our scientific activities prioritize the development and localization of satellite systems, Earth observation payloads that directly support national agriculture, water, and environmental resources, and foundational research contributing to peaceful international space exploration.
              </p>
              <div className="research-action-row">
                <Cta to="/about" variant="navy">Explore Institutional Profile</Cta>
                <Cta to="/contact?subject=Research%20Collaboration" variant="teal">Propose Research Collaboration</Cta>
              </div>
            </div>

            <div className="research-mandate-card">
              <span className="research-mandate-badge">Statutory Directives</span>
              <ul className="research-mandate-list">
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Transfer, develop, and localize space technology in Egypt</span>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Build and launch sovereign satellites from Egyptian territory</span>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Drive interdisciplinary aerospace innovation and STEM expertise</span>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Promote the responsible, peaceful utilization of outer space</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Research Pillars Grid */}
      <section className="dark research-pillars-section">
        <div className="wrap">
          <div className="section-header-centered">
            <span className="section-eyebrow gold">SCIENTIFIC FOCUS AREAS</span>
            <h2>Strategic Research Pillars</h2>
            <p className="section-sub text-white-muted">The core aerospace domains guiding research and development at the Egyptian Space Agency.</p>
          </div>

          <div className="research-pillars-grid">
            {researchPillars.map((p, idx) => (
              <div className="research-pillar-card" key={p.id}>
                <div className="research-pillar-top">
                  <span className="research-pillar-index">Pillar 0{idx + 1}</span>
                  <h3>{p.title}</h3>
                </div>
                <p className="research-pillar-lead">{p.lead}</p>
                <div className="research-pillar-items">
                  <h4>Key Technical Focus</h4>
                  <ul>
                    {p.items.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AIT Facilities Showcase */}
      <section className="light research-facilities-section">
        <div className="wrap">
          <div className="research-facilities-card">
            <div className="research-facilities-info">
              <span className="section-eyebrow">SPECIALIZED INFRASTRUCTURE</span>
              <h2>Satellite Assembly, Integration &amp; Testing (AIT) Facilities</h2>
              <p>
                EGSA houses world-class Satellite Assembly, Integration, and Testing (AIT) infrastructure in Egyptian Space City. These facilities feature precision ISO-certified cleanrooms, vibration shaker tables, thermal vacuum (TVAC) chambers, and anechoic RF test chambers designed to test flight hardware against the rigorous extremes of orbital launch and space environments.
              </p>
              <div className="research-facilities-badges">
                <span className="research-facility-badge">Cleanroom Integration</span>
                <span className="research-facility-badge">Thermal Vacuum (TVAC)</span>
                <span className="research-facility-badge">Vibration &amp; Shock Testing</span>
                <span className="research-facility-badge">EMC/EMI Anechoic Chamber</span>
              </div>
              <div className="research-facilities-actions">
                <Cta href="https://egsa.gov.eg/facilities/labs" variant="gold">Official AIT Facilities &amp; Labs Portal</Cta>
                <Cta to="/contact?subject=Research%20Facility%20Access" variant="ghost">Facility Collaboration Inquiries</Cta>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

