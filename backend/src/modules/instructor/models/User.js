const { Schema, model } = require('mongoose');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const userSchema = new Schema({
  name: { type: String, trim: true, maxlength: 120 },
  fullName: { type: String, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  externalId: { type: String, trim: true, index: true, sparse: true },
  passwordHash: { type: String, select: false },
  password: { type: String, select: false },
  role: { type: String, default: 'instructor' },
  phone: { type: String, trim: true, maxlength: 30 },
  professional: {
    title: { type: String, trim: true, maxlength: 120 },
    organization: { type: String, trim: true, maxlength: 160 },
    expertise: { type: String, trim: true, maxlength: 500 },
  },
  preferredLanguage: { type: String, enum: ['en', 'ar'], default: 'en' },
  avatarUrl: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, default: 'active' },
  isActive: { type: Boolean, default: true },
  refreshTokenHashes: { type: [String], select: false, default: [] }, // one per active session/device (max 5)
  passwordResetHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
}, { timestamps: true });
userSchema.methods.toSafe = function () {
  const o = this.toObject();
  o.name = o.name || o.fullName || 'Instructor';
  delete o.passwordHash; delete o.password; delete o.refreshTokenHashes; delete o.passwordResetHash; delete o.passwordResetExpires; delete o.__v;
  return o;
};
const { getInstructorConn } = require('../../../config/database');
const conn = getInstructorConn();
module.exports = conn.models.User || conn.model('User', userSchema);
