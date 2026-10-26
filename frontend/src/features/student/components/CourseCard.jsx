import React from 'react';
import { Link } from 'react-router-dom';
import '../pages/student/ExploreProgramsPage.css';

export default function CourseCard({ course }) {
  return (
    <div className="egsa-program-card h-100 d-flex flex-column justify-content-between position-relative">
      <div>
        <div className="egsa-badges-row">
          <div className="d-flex align-items-center gap-1 flex-wrap">
            {course.category && (
              <span className="egsa-badge-category">{course.category}</span>
            )}
            <span className="egsa-badge-level">{course.level || 'Standard'}</span>
          </div>
        </div>

        <h5 className="egsa-program-title" title={course.title}>{course.title}</h5>
        {course.tagline && (
          <p className="egsa-program-tagline" title={course.tagline}>
            {course.tagline}
          </p>
        )}
        <p className="egsa-program-desc">
          {course.shortDescription || course.overview || 'Comprehensive practical curriculum designed by Egyptian Space Agency engineers.'}
        </p>

        <ul className="egsa-program-meta">
          <li className="egsa-program-meta-item">
            <i className="fa-regular fa-clock egsa-meta-icon"></i>
            <span>
              {course.duration != null ? `${course.duration} ${course.durationUnit || 'Days'}` : 'Duration TBA'}
              {course.hoursPerDay ? ` · ${course.hoursPerDay}` : ''}
            </span>
          </li>
          <li className="egsa-program-meta-item">
            <i className="fa-solid fa-location-dot egsa-meta-icon"></i>
            <span>{course.deliveryMode}</span>
          </li>
          {course.startDate && (
            <li className="egsa-program-meta-item">
              <i className="fa-regular fa-calendar egsa-meta-icon"></i>
              <span>Starts {new Date(course.startDate).toLocaleDateString()}</span>
            </li>
          )}
          {course.capacity != null && (
            <li className="egsa-program-meta-item">
              <i className="fa-solid fa-users egsa-meta-icon"></i>
              <span>{course.availableSeats ?? course.capacity} seats available</span>
            </li>
          )}
        </ul>
      </div>

      <div className="egsa-card-actions-wrapper">
        <div className="egsa-program-pricing-block">
          <span className="egsa-tuition-label">Tuition</span>
          <div className="egsa-price-value">
            {course.price != null ? (
              <>{course.price.toLocaleString()} <span className="egsa-currency">{course.currency || 'EGP'}</span></>
            ) : (
              'Pricing TBA'
            )}
          </div>
        </div>

        <div className="egsa-actions-container">
          <div className="w-100">
            <Link
              to={`/student/courses/${course._id}`}
              className="btn egsa-btn-primary w-100"
            >
              <i className="fa-solid fa-paper-plane me-1.5"></i> Apply Now
            </Link>
          </div>
          <div className="egsa-subtle-links-row">
            <Link
              to={`/student/courses/${course._id}/fit`}
              className="egsa-subtle-link"
              title="Prerequisite Alignment & Course Fit"
            >
              <i className="fa-solid fa-magnifying-glass-chart egsa-subtle-icon"></i> Course Fit
            </Link>
            <span className="egsa-subtle-divider">·</span>
            <Link
              to={`/student/courses/${course._id}`}
              className="egsa-subtle-link"
              title="Prerequisite and Readiness diagnostic"
            >
              <i className="fa-solid fa-clipboard-check egsa-subtle-icon"></i> Readiness
            </Link>
          </div>
          <div className="egsa-card-footer">
            <span className="egsa-footer-accreditation">
              <i className="fa-regular fa-circle-check text-success me-1"></i>Accredited EGSA Program
            </span>
            <Link
              to={`/student/courses/${course._id}`}
              className="egsa-footer-details-link"
            >
              View Details <i className="fa-solid fa-arrow-right egsa-footer-arrow"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
