const { Schema, model } = require('mongoose');
const { COURSE_STATUS } = require('../config/constants');
const { getInstructorConn } = require('../../../config/database');
const conn = getInstructorConn();
module.exports = conn.models.Course || conn.model('Course', new Schema({
  externalCourseId: { type: String, index: true },   // id in the Student Project (future integration)
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  durationWeeks: { type: Number, min: 0 },
  status: { type: String, enum: Object.values(COURSE_STATUS), default: COURSE_STATUS.ACTIVE },
}, { timestamps: true }));
