const { Schema, model } = require('mongoose');
// Minimal reference to a student owned by the Student Project. Academic-contact data only. NEVER payment/password data.
const { getInstructorConn } = require('../../../config/database');
const conn = getInstructorConn();
module.exports = conn.models.StudentReference || conn.model('StudentReference', new Schema({
  externalStudentId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
}, { timestamps: true }));
