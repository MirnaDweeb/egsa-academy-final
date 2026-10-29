require('dotenv').config();
const mongoose = require('mongoose');

async function fixEnrollmentIndexes() {
  const uri = process.env.STUDENT_MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy';
  const conn = mongoose.createConnection(uri);
  await conn.asPromise();

  try {
    await conn.collection('enrollments').dropIndex('student_1_cohort_1');
    console.log('[INDEX MIGRATION] Dropped obsolete index student_1_cohort_1');
  } catch (err) {
    console.log('[INDEX MIGRATION] Notice on dropIndex:', err.message);
  }

  await conn.collection('enrollments').createIndex(
    { student: 1, cohort: 1 },
    { unique: true, partialFilterExpression: { cohort: { $type: 'objectId' } } }
  );
  console.log('[INDEX MIGRATION] Recreated partial index student_1_cohort_1');

  await conn.close();
}

if (require.main === module) {
  fixEnrollmentIndexes().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { fixEnrollmentIndexes };
