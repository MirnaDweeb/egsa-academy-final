/**
 * feedbackController.js
 *
 * Controllers for Admin Feedback Center and Student Feedback Submission.
 */

const feedbackService = require('../services/feedbackService');

/**
 * GET /api/admin/feedback
 */
async function listFeedbackAdminController(req, res, next) {
  try {
    const { division, program, cohort, rating, feedbackType, sentiment, search, page, limit } = req.query;
    const activeDivision = req.scopeDivision || req.division || division;

    const result = await feedbackService.listFeedbackAdmin({
      user: req.user,
      division: activeDivision,
      program,
      cohort,
      rating,
      feedbackType,
      sentiment,
      search,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/feedback/summary
 */
async function getFeedbackSummaryAdminController(req, res, next) {
  try {
    const { division, program, cohort } = req.query;
    const activeDivision = req.scopeDivision || req.division || division;

    const result = await feedbackService.getFeedbackSummaryAdmin({
      user: req.user,
      division: activeDivision,
      program,
      cohort,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/student/mine/feedback
 */
async function submitFeedbackController(req, res, next) {
  try {
    const { programId, cohortId, rating, feedbackType, comments, strengths, improvements } = req.body;
    const feedback = await feedbackService.submitStudentFeedback({
      studentId: req.user._id,
      programId,
      cohortId,
      rating,
      feedbackType,
      comments,
      strengths,
      improvements,
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully. Thank you for helping improve the Academy.',
      data: { feedback },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin-api/admin/evaluations
 * Returns Gate 4 Course & Instructor evaluation completion stats & aggregate telemetry.
 */
async function getCourseEvaluationsAdminController(req, res, next) {
  try {
    const { program, cohort } = req.query;
    const activeDivision = req.scopeDivision || req.division || req.query.division;
    const { ROLES } = require('../constants/roles');
    const { ROLE_TO_DIVISION } = require('../constants/divisions');
    const ApiError = require('../utils/ApiError');

    const effectiveDivision = (req.user && req.user.role !== ROLES.SUPER_ADMIN)
      ? (req.scopeDivision || req.user.division || ROLE_TO_DIVISION[req.user.role])
      : (req.query.division && req.query.division !== 'all' ? req.query.division : req.scopeDivision);

    // Division isolation check: If division admin attempts to access cross-division telemetry
    if (req.user && req.user.role !== ROLES.SUPER_ADMIN) {
      if (req.query.division && req.query.division !== 'all' && req.query.division !== effectiveDivision) {
        throw ApiError.forbidden(`Cross-division access denied: You cannot view evaluations for ${req.query.division}`);
      }
      if (req.query.division === 'all') {
        throw ApiError.forbidden('Cross-division access denied: Division admins cannot access cross-division evaluations');
      }
    }

    const { getStudentConn } = require('../../../config/database');
    const sConn = getStudentConn();
    const Evaluation = sConn.models.Evaluation || sConn.model('Evaluation');
    const Enrollment = sConn.models.Enrollment || sConn.model('Enrollment');
    const Course = sConn.models.Course || sConn.model('Course');

    const filter = {};
    let courseQuery = {};

    if (effectiveDivision && effectiveDivision !== 'all') {
      const divisionCourses = await Course.find({ division: effectiveDivision }).distinct('_id');
      if (program) {
        const isBelonging = divisionCourses.some((id) => id.toString() === program.toString());
        if (!isBelonging) {
          throw ApiError.forbidden('Cross-division access denied: Program does not belong to your division');
        }
        filter.course = program;
        courseQuery = { course: program };
      } else {
        filter.course = { $in: divisionCourses };
        courseQuery = { course: { $in: divisionCourses } };
      }
    } else if (program) {
      filter.course = program;
      courseQuery = { course: program };
    }

    if (cohort) filter.cohort = cohort;

    const coursesQuery = (effectiveDivision && effectiveDivision !== 'all') ? { division: effectiveDivision } : {};
    const [evaluations, totalEnrollments, availableCourses] = await Promise.all([
      Evaluation.find(filter)
        .populate('course', 'title code level')
        .populate('cohort', 'name')
        .sort({ createdAt: -1 })
        .lean(),
      Enrollment.countDocuments({
        status: { $in: ['Confirmed', 'Active', 'Completed'] },
        ...courseQuery,
        ...(cohort ? { cohort: cohort } : {}),
      }),
      Course.find(coursesQuery).select('title code slug division').lean(),
    ]);

    const count = evaluations.length;
    let contentSum = 0, instructorSum = 0, labsSum = 0, orgSum = 0;
    let envSum = 0, facSum = 0, staffSum = 0, platSum = 0, overallSatSum = 0;
    let recommendYes = 0, agencyCount = 0;
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    evaluations.forEach((e) => {
      const c = e.ratings?.content || 0;
      const i = e.ratings?.instructor || 0;
      const l = e.ratings?.labs || 0;
      const o = e.ratings?.organization || 0;
      contentSum += c;
      instructorSum += i;
      labsSum += l;
      orgSum += o;

      const avg = Math.round((c + i + l + o) / 4) || 5;
      if (ratingDistribution[avg] !== undefined) ratingDistribution[avg]++;

      if (e.agencyFeedbackCompleted && e.agencyFeedback) {
        agencyCount++;
        envSum += e.agencyFeedback.trainingEnvironment || 0;
        facSum += e.agencyFeedback.facilitiesAndLabs || 0;
        staffSum += e.agencyFeedback.organizationAndStaff || 0;
        platSum += e.agencyFeedback.platformExperience || 0;
        overallSatSum += e.agencyFeedback.overallSatisfaction || 0;
        if (e.agencyFeedback.recommendAgency !== false) recommendYes++;
      }
    });

    // Sanitized evaluations without ANY student identity or database ObjectId
    const sanitizedEvaluations = evaluations.map((e, idx) => ({
      _id: `anon-eval-${idx + 1}`,
      anonymousCadetTag: `Cadet #${idx + 1}`,
      courseTitle: e.course?.title || 'EGSA Space Program',
      courseCode: e.course?.code || 'EGSA-PROG',
      cohortName: e.cohort?.name || 'General Training Batch',
      ratings: e.ratings,
      // Small-cohort privacy protection (< 3 submissions)
      comments: count >= 3 ? e.comments : {
        highlights: e.comments?.highlights ? 'Withheld for small-cohort privacy' : '',
        improvements: e.comments?.improvements ? 'Withheld for small-cohort privacy' : '',
      },
      courseFeedbackCompleted: Boolean(e.courseFeedbackCompleted),
      agencyFeedback: e.agencyFeedback ? {
        trainingEnvironment: e.agencyFeedback.trainingEnvironment,
        facilitiesAndLabs: e.agencyFeedback.facilitiesAndLabs,
        organizationAndStaff: e.agencyFeedback.organizationAndStaff,
        platformExperience: e.agencyFeedback.platformExperience,
        overallSatisfaction: e.agencyFeedback.overallSatisfaction,
        recommendAgency: e.agencyFeedback.recommendAgency,
        comments: count >= 3 ? e.agencyFeedback.comments : (e.agencyFeedback.comments ? 'Withheld for small-cohort privacy' : ''),
      } : null,
      agencyFeedbackCompleted: Boolean(e.agencyFeedbackCompleted),
      isFullyCompleted: Boolean(e.courseFeedbackCompleted && e.agencyFeedbackCompleted),
      submittedDate: (e.submittedAt || e.createdAt)
        ? new Date(e.submittedAt || e.createdAt).toISOString().split('T')[0]
        : null,
    }));

    const completionRate = totalEnrollments > 0 ? Math.min(100, Math.round((count / totalEnrollments) * 100)) : (count > 0 ? 100 : 0);

    res.json({
      success: true,
      data: {
        stats: {
          totalEvaluations: count,
          totalEligibleEnrollments: totalEnrollments,
          completionRate,
          pendingEvaluations: Math.max(0, totalEnrollments - count),
        },
        programs: (availableCourses || []).map((c) => ({
          _id: c._id,
          title: c.title,
          code: c.code || (c.slug ? c.slug.toUpperCase() : 'EGSA-PROG'),
          division: c.division,
        })),
        courseAverages: {
          content: count > 0 ? Number((contentSum / count).toFixed(2)) : 0,
          instructor: count > 0 ? Number((instructorSum / count).toFixed(2)) : 0,
          labs: count > 0 ? Number((labsSum / count).toFixed(2)) : 0,
          organization: count > 0 ? Number((orgSum / count).toFixed(2)) : 0,
          overall: count > 0 ? Number(((contentSum + instructorSum + labsSum + orgSum) / (4 * count)).toFixed(2)) : 0,
        },
        agencyAverages: agencyCount > 0 ? {
          trainingEnvironment: Number((envSum / agencyCount).toFixed(2)),
          facilitiesAndLabs: Number((facSum / agencyCount).toFixed(2)),
          organizationAndStaff: Number((staffSum / agencyCount).toFixed(2)),
          platformExperience: Number((platSum / agencyCount).toFixed(2)),
          overallSatisfaction: Number((overallSatSum / agencyCount).toFixed(2)),
          recommendPercentage: Math.round((recommendYes / agencyCount) * 100),
        } : null,
        ratingDistribution,
        evaluations: sanitizedEvaluations,
        privacyNotice: count >= 3
          ? 'Student identities are protected: all responses are compiled and presented anonymously.'
          : 'Small-cohort privacy protection active (< 3 evaluations): individual comments are withheld.',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listFeedbackAdminController,
  getFeedbackSummaryAdminController,
  submitFeedbackController,
  getCourseEvaluationsAdminController,
};
