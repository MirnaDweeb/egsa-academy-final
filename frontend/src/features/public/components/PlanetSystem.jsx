import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { SKINS } from '../data';

export const MAX_PLANETS = 6;

export default function PlanetSystem({ items = [] }) {
  const featured = items.slice(0, MAX_PLANETS);
  const key = featured.map(p => p.slug).join();
  const [sel, setSel] = useState(0);
  const root = useRef(null);
  const cur = featured[Math.min(sel, Math.max(0, featured.length - 1))];

  useEffect(() => {
    setSel(0);
  }, [key]);

  // Orbital GSAP Animation
  useEffect(() => {
    if (!root.current || !featured.length) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      // Entrance reveal
      gsap.fromTo(
        '.orbit-path',
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.1, stagger: 0.1, ease: 'power3.out' }
      );
      gsap.fromTo(
        '.planet-node',
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.9, stagger: 0.08, delay: 0.3, ease: 'back.out(1.5)' }
      );

      if (reduce) return;

      // Continuous orbital revolution
      gsap.utils.toArray('.orbit-path').forEach((ring, i) => {
        const dur = 45 + i * 18;
        const dir = i % 2 === 0 ? 1 : -1;
        const initialAngle = i * 60 + (i % 3) * 15;
        const slot = ring.querySelector('.planet-slot');

        gsap.set(ring, { rotation: initialAngle });
        if (slot) gsap.set(slot, { rotation: -initialAngle });

        gsap.to(ring, {
          rotation: initialAngle + 360 * dir,
          duration: dur,
          ease: 'none',
          repeat: -1
        });

        if (slot) {
          gsap.to(slot, {
            rotation: -initialAngle - 360 * dir,
            duration: dur,
            ease: 'none',
            repeat: -1
          });
        }
      });
    }, root);

    return () => ctx.revert();
  }, [key, featured.length]);

  // Detail panel animation on selection
  useEffect(() => {
    if (!root.current || !cur) return;
    const c = gsap.context(() => {
      gsap.fromTo(
        '.system-detail-content > *',
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, stagger: 0.05, ease: 'power2.out' }
      );
    }, root);
    return () => c.revert();
  }, [sel, key, cur]);

  if (!cur || featured.length === 0) {
    return (
      <div className="system-empty-state">
        <p className="system-empty-text">No courses match the current category or filter.</p>
      </div>
    );
  }

  const curSkin = cur.planetSkin || SKINS[sel % SKINS.length];

  return (
    <div className="system-container" ref={root} aria-label="Interactive Space Training Planetary Map">
      {/* Planetary Orbit Viewport */}
      <div className="system-stage" role="region" aria-label="Planetary orbit exploration">
        {/* Central Space Agency Core */}
        <div className="system-core-wrapper" title="Egyptian Space Agency Core">
          <div className="system-core-halo" aria-hidden="true" />
          <div className="system-core-glow" aria-hidden="true" />
          <div className={`system-core planet ${curSkin}`} aria-hidden="true">
            <span className="core-symbol">EGSA</span>
          </div>
        </div>

        {/* Orbit Rings and Planets */}
        {featured.map((p, i) => {
          const skin = p.planetSkin || SKINS[i % SKINS.length];
          const isSelected = i === sel;
          // Radius calculation for concentric visual spacing
          const radiusPercent = 22 + i * 5.8;

          return (
            <div
              key={p.slug}
              className={`orbit-path ${isSelected ? 'active-orbit' : ''}`}
              style={{ '--orbit-radius': `${radiusPercent}%` }}
            >
              <div className="planet-slot">
                <button
                  type="button"
                  className={`planet-node planet sm ${skin} ${isSelected ? 'selected' : ''}`}
                  aria-pressed={isSelected}
                  aria-label={`${p.title} (${p.category})`}
                  title={`${p.title} • ${p.category}`}
                  onClick={() => setSel(i)}
                >
                  <span className="planet-node-ring" aria-hidden="true" />
                  <span className="planet-node-label" aria-hidden="true">
                    {p.title}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Course Detail Card Panel */}
      <div className="system-detail-panel" aria-live="polite">
        <div className="system-detail-content">
          <div className="system-detail-meta-top">
            <span className="system-category-pill">{cur.category}</span>
            {cur.level && <span className="system-level-pill">{cur.level}</span>}
            <span className="system-status-indicator">
              <span className="status-indicator-dot" aria-hidden="true" />
              {cur.status === 'published' ? 'Official Course' : 'Details Pending'}
            </span>
          </div>

          <h3 className="system-detail-title">{cur.title}</h3>

          <p className="system-detail-tagline">{cur.tagline || cur.subtitle}</p>

          <p className="system-detail-summary">
            {cur.summary || (cur.overview && cur.overview[0])}
          </p>

          <div className="system-detail-specs">
            {cur.duration && (
              <div className="spec-item">
                <span className="spec-label">Duration</span>
                <span className="spec-value">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {cur.duration}
                </span>
              </div>
            )}
            {cur.audience && cur.audience.length > 0 && (
              <div className="spec-item">
                <span className="spec-label">Target Audience</span>
                <span className="spec-value spec-audience">
                  {cur.audience.slice(0, 2).join(' • ')}
                </span>
              </div>
            )}
          </div>

          <div className="system-detail-actions">
            <Link className="btn gold sm" to={`/programs/${cur.slug}`}>
              <span>Explore Course Details</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link className="btn ghost sm" to={`/contact?program=${cur.slug}`}>
              <span>Enquire</span>
            </Link>
          </div>

          {/* Stepper Navigation */}
          <div className="system-stepper" role="group" aria-label="Course carousel navigation">
            <button
              type="button"
              className="stepper-nav-btn"
              aria-label="Previous course"
              onClick={() => setSel((sel + featured.length - 1) % featured.length)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="stepper-counter">
              <span className="current-step">{(sel + 1).toString().padStart(2, '0')}</span>
              <span className="divider">/</span>
              <span className="total-step">{featured.length.toString().padStart(2, '0')}</span>
            </div>
            <button
              type="button"
              className="stepper-nav-btn"
              aria-label="Next course"
              onClick={() => setSel((sel + 1) % featured.length)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
