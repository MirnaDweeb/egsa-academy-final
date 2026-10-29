const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/modules/integration/unifiedSyncService.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Patch line ~250 in syncEnrollment
const target1 = `        let adminCohort = await A.Cohort.findOne({ program: adminCourse._id });
        if (!adminCohort) {
          adminCohort = await A.Cohort.create({
            name: \`\${adminCourse.title} - Cohort 1\`,
            program: adminCourse._id,
            instructor: adminInstId || adminUser._id,
            division: adminCourse.division,
            capacity: adminCourse.capacity || 25,
            startDate: adminCourse.startDate || new Date(),
            endDate: adminCourse.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            status: 'SCHEDULED',
            createdBy: adminUser._id,
          });
        }`;

const replacement1 = `        let adminCohort = await A.Cohort.findOne({ program: adminCourse._id });
        if (!adminCohort) {
          const cCode = (adminCourse.code || courseIdStr.slice(-4)).toUpperCase();
          const cohortNumber = \`COH-\${cCode}-\${Date.now().toString().slice(-4)}-\${Math.floor(Math.random() * 900 + 100)}\`;
          adminCohort = await A.Cohort.create({
            cohortNumber,
            name: \`\${adminCourse.title} - Cohort 1\`,
            program: adminCourse._id,
            instructor: adminInstId || adminUser._id,
            division: adminCourse.division,
            capacity: adminCourse.capacity || 25,
            startDate: adminCourse.startDate || new Date(),
            endDate: adminCourse.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            status: 'SCHEDULED',
            createdBy: adminUser._id,
          });
        }`;

// 2. Patch line ~1315 in syncCourseInstructorAssignment
const target2 = `    // 5. Update / create Cohort in Admin DB
    let adminCohort = await A.Cohort.findOne({ program: adminCourse._id });
    if (adminCohort) {
      adminCohort.instructor = adminInstructor._id;
      await adminCohort.save();
    } else {
      adminCohort = await A.Cohort.create({
        name: \`\${adminCourse.title} - Cohort 1\`,
        program: adminCourse._id,
        instructor: adminInstructor._id,
        division: adminCourse.division,
        capacity: adminCourse.capacity || 25,
        startDate: adminCourse.startDate || new Date(),
        endDate: adminCourse.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'SCHEDULED',
        createdBy: user?._id || adminInstructor._id,
      });
    }`;

const replacement2 = `    // 5. Update / create Cohort in Admin DB
    let adminCohort = await A.Cohort.findOne({ program: adminCourse._id });
    if (adminCohort) {
      adminCohort.instructor = adminInstructor._id;
      await adminCohort.save();
    } else {
      const cCode = (adminCourse.code || courseIdStr.slice(-4)).toUpperCase();
      const cohortNumber = \`COH-\${cCode}-\${Date.now().toString().slice(-4)}-\${Math.floor(Math.random() * 900 + 100)}\`;
      adminCohort = await A.Cohort.create({
        cohortNumber,
        name: \`\${adminCourse.title} - Cohort 1\`,
        program: adminCourse._id,
        instructor: adminInstructor._id,
        division: adminCourse.division,
        capacity: adminCourse.capacity || 25,
        startDate: adminCourse.startDate || new Date(),
        endDate: adminCourse.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'SCHEDULED',
        createdBy: user?._id || adminInstructor._id,
      });
    }`;

// Normalize line breaks for matching
const normContent = content.replace(/\r\n/g, '\n');
const normT1 = target1.replace(/\r\n/g, '\n');
const normT2 = target2.replace(/\r\n/g, '\n');

if (normContent.includes(normT1)) {
  console.log('Target 1 matched');
} else {
  console.error('Target 1 not matched');
}

if (normContent.includes(normT2)) {
  console.log('Target 2 matched');
} else {
  console.error('Target 2 not matched');
}

let patched = normContent.replace(normT1, replacement1.replace(/\r\n/g, '\n')).replace(normT2, replacement2.replace(/\r\n/g, '\n'));

if (content.includes('\r\n')) {
  patched = patched.replace(/\n/g, '\r\n');
}

fs.writeFileSync(file, patched, 'utf8');
console.log('Successfully patched unifiedSyncService.js with cohortNumber');

