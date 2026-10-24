const mongoose = require('mongoose');

const ReadinessQuestionSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: false, default: null },
    isDefault: { type: Boolean, default: false },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswerIndex: { type: Number, required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  },
  { timestamps: true }
);

const { getStudentConn } = require('../../../config/database');
const conn = getStudentConn();
module.exports = conn.models.ReadinessQuestion || conn.model('ReadinessQuestion', ReadinessQuestionSchema);
