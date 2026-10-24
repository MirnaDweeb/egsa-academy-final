const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ROLES } = require('../constants/roles');
const { DIVISIONS } = require('../constants/divisions');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, select: false },
    password: { type: String, select: false },
    role: {
      type: String,
      default: ROLES.STUDENT,
      required: true,
      index: true,
    },
    // Only populated for PRE_UNIVERSITY_ADMIN / UNIVERSITY_ADMIN accounts.
    // Kept denormalized on the user for fast auth-time scope checks; the
    // authoritative record lives in AdminScope for auditability.
    division: {
      type: String,
      enum: [...Object.values(DIVISIONS), null, 'all'],
      default: null,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    permissions: {
      type: [String],
      default: [],
    },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(candidate) {
  const hash = this.passwordHash || this.password;
  if (!hash) return false;
  return bcrypt.compare(candidate, hash);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    division: this.division || null,
    isActive: this.isActive,
    permissions: this.permissions || [],
    createdAt: this.createdAt,
    createdBy: this.createdBy || null,
  };
};

module.exports = mongoose.model('User', userSchema);
