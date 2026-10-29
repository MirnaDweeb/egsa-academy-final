const { Cohort, Course, Session, EnrollmentReference } = require('../models');
const { ENROLLMENT_STATUS, COHORT_STATUS, SESSION_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { isId } = require('../utils/helpers');
const { ownedCohort } = require('./ownership.service');
const { cohortProgress } = require('./progress.service');
const { Assessment } = require('../models');

async function decorateCohorts(cohorts) {
  return Promise.all(cohorts.map(async (c) => {
    const [enrolled, sessions, next] = await Promise.all([
      EnrollmentReference.countDocuments({ cohort: c._id, status: ENROLLMENT_STATUS.ACTIVE }),
      Session.countDocuments({ cohort: c._id }),
      Session.findOne({ cohort: c._id, status: SESSION_STATUS.SCHEDULED, startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).select('title date startTime').lean(),
    ]);
    return { ...c, enrolledCount: enrolled, sessionsCount: sessions, nextSession: next };
  }));
}
async function listCohorts(instructorId, { status, courseId }) {
  const q = { instructor: instructorId, ...(status ? { status } : {}), ...(courseId && isId(courseId) ? { course: courseId } : {}) };
  const cohorts = await Cohort.find(q).populate('course', 'name code status').populate('instructor', 'name').sort({ startDate: -1 }).lean();
  return decorateCohorts(cohorts);
}
async function getCohort(instructorId, id) {
  const c = await ownedCohort(instructorId, id);
  const [full] = await decorateCohorts([(await c.populate([{ path: 'course', select: 'name code description status durationWeeks' }, { path: 'instructor', select: 'name' }])).toObject()]);
  const [assessments, progress] = await Promise.all([Assessment.countDocuments({ cohort: c._id }), cohortProgress(c._id)]);
  return { ...full, assessmentsCount: assessments, studentsSummary: { total: progress.length } };
}
async function listCourses(instructorId) {
  const cohorts = await Cohort.find({ instructor: instructorId }).lean();
  const ids = [...new Set(cohorts.map((c) => String(c.course)))];
  const courses = await Course.find({ _id: { $in: ids } }).sort({ name: 1 }).lean();
  return courses.map((c) => ({ ...c, assignedCohorts: cohorts.filter((x) => String(x.course) === String(c._id)).map((x) => ({ _id: x._id, name: x.name, status: x.status })) }));
}
async function getCourse(instructorId, id) {
  if (!isId(id)) throw ApiError.notFound();
  const cohorts = await Cohort.find({ instructor: instructorId, course: id }).lean();
  if (!cohorts.length) throw ApiError.notFound(); // not assigned => not found
  const course = await Course.findById(id).lean();
  return { ...course, assignedCohorts: await decorateCohorts(cohorts) };
}

async function getCourseEvaluations(instructorId, courseId) {
  const cId = String(courseId);
  if (!isId(cId)) throw ApiError.notFound();
  const cohorts = await Cohort.find({ instructor: instructorId, course: cId }).lean();
  if (!cohorts.length) throw ApiError.forbidden('You are not assigned to instruct this course');

  const course = await Course.findById(cId).lean();
  if (!course) throw ApiError.notFound();

  const { getStudentConn } = require('../../../config/database');
  const sConn = getStudentConn();
  const Evaluation = sConn.models.Evaluation || sConn.model('Evaluation');

  const courseQueryIds = [cId];
  if (course.externalCourseId && isId(String(course.externalCourseId))) {
    courseQueryIds.push(String(course.externalCourseId));
  }

  const evals = await Evaluation.find({ course: { $in: courseQueryIds } }).lean();
  const count = evals.length;

  let contentSum = 0;
  let instructorSum = 0;
  let labsSum = 0;
  let orgSum = 0;
  const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  evals.forEach((e) => {
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
  });

  // k-anonymity protection: only expose qualitative quotes if at least 3 evaluations exist
  const canExposeQuotes = count >= 3;
  const anonymousComments = canExposeQuotes
    ? evals
        .filter((e) => e.comments?.highlights || e.comments?.improvements)
        .map((e) => ({
          highlights: e.comments?.highlights || '',
          improvements: e.comments?.improvements || '',
        }))
        // Decouple from database insertion order
        .sort(() => 0.5 - Math.random())
    : [];

  const avgContent = count > 0 ? Number((contentSum / count).toFixed(2)) : 0;
  const avgInstructor = count > 0 ? Number((instructorSum / count).toFixed(2)) : 0;
  const avgLabs = count > 0 ? Number((labsSum / count).toFixed(2)) : 0;
  const avgOrg = count > 0 ? Number((orgSum / count).toFixed(2)) : 0;
  const overallAvg = count > 0 ? Number(((avgContent + avgInstructor + avgLabs + avgOrg) / 4).toFixed(2)) : 0;

  return {
    courseId,
    courseName: course.name,
    courseCode: course.code,
    totalEvaluations: count,
    overallAverage: overallAvg,
    averages: {
      content: avgContent,
      instructor: avgInstructor,
      labs: avgLabs,
      organization: avgOrg,
    },
    ratingDistribution,
    anonymousComments,
    privacyNotice: canExposeQuotes
      ? 'Student identities are protected under Egyptian Space Agency academic privacy policy: all evaluations are anonymous.'
      : 'Small-cohort protection active (< 3 evaluations): individual comments are withheld to preserve anonymous cadet privacy.',
  };
}

module.exports = { listCohorts, getCohort, listCourses, getCourse, getCourseEvaluations };
