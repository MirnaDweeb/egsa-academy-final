const mongoose = require('mongoose');

const PaymentSettingsSchema = new mongoose.Schema(
  {
    vodafoneCash: {
      walletNumber: { type: String, default: '01012345678' },
      accountName: { type: String, default: 'Egyptian Space Agency — National Training Fund' },
      instructionsEn: {
        type: String,
        default: 'Transfer the exact tuition fee to the official Vodafone Cash wallet number. Enter your student registration or invoice number in the transfer notes, and upload the confirmation screenshot below.',
      },
      instructionsAr: {
        type: String,
        default: 'قم بتحويل الرسوم المقررة بدقة إلى رقم محفظة فودافون كاش الرسمي لوكالة الفضاء المصرية. يرجى كتابة اسمك أو رقم الفاتورة في خانة الملاحظات ورفع صورة التأكيد بالأسفل.',
      },
      isActive: { type: Boolean, default: true },
    },
    instaPay: {
      ipaAddress: { type: String, default: 'egsa.academy@instapay' },
      accountName: { type: String, default: 'Egyptian Space Agency' },
      bankName: { type: String, default: 'National Bank of Egypt (NBE)' },
      instructionsEn: {
        type: String,
        default: 'Transfer tuition via the InstaPay application to the official Space Agency IPA address. Ensure the transfer receipt clearly shows the transaction reference number and amount.',
      },
      instructionsAr: {
        type: String,
        default: 'قم بتحويل المصروفات عبر تطبيق إنستاباي إلى العنوان الرسمي المعتمد لوكالة الفضاء المصرية. يرجى التأكد من وضوح الرقم المرجعي للمعاملة وتفاصيل السداد في إيصال التحويل.',
      },
      isActive: { type: Boolean, default: true },
    },
    uploadLimits: {
      maxFileSizeMB: { type: Number, default: 5 },
      allowedFormats: {
        type: [String],
        default: ['image/jpeg', 'image/png', 'image/webp'],
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/**
 * Returns the singleton payment settings document or creates safe defaults.
 */
PaymentSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const { getStudentConn } = require('../../../config/database');
const conn = getStudentConn();
module.exports = conn.models.PaymentSettings || conn.model('PaymentSettings', PaymentSettingsSchema);
