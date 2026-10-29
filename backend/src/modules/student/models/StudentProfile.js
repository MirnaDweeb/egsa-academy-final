const mongoose = require('mongoose');

const StudentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    division: {
      type: String,
      enum: ['PRE_UNIVERSITY', 'UNIVERSITY'],
      default: 'UNIVERSITY',
      index: true,
    },
    dateOfBirth: { type: Date },
    status: { type: String, enum: ['student', 'graduate'], required: true },
    university: { type: String, required: true },
    faculty: { type: String, required: true },
    department: { type: String },
    academicYear: { type: String },
    graduationYear: { type: Number },
    skills: [{ type: String }],
    experience: [{ type: String }],
    previousTraining: [{ type: String }],
    learningGoal: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningGoal' },
    completedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    profileCompleted: { type: Boolean, default: false },
    institution: { type: String, trim: true },
    educationLevel: { type: String, trim: true, default: '' },
    major: { type: String, trim: true, default: '' },
    gpa: { type: Number, default: null },
    notes: { type: String, trim: true },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    nationalId: { type: String, trim: true },
    phone: { type: String, trim: true },
    personalInfo: { type: mongoose.Schema.Types.Mixed },
    academicInfo: { type: mongoose.Schema.Types.Mixed },
    spaceExperience: { type: mongoose.Schema.Types.Mixed },
    profileCompletionPercentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

StudentProfileSchema.index({ division: 1, createdAt: -1 });

const { getStudentConn } = require('../../../config/database');
const conn = getStudentConn();
module.exports = conn.models.StudentProfile || conn.model('StudentProfile', StudentProfileSchema);
