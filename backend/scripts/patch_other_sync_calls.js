const fs = require('fs');
const path = require('path');

// 1. admissionService.js
const admFile = path.resolve(__dirname, '../src/modules/student/services/admissionService.js');
let adm = fs.readFileSync(admFile, 'utf8');
adm = adm.replace('syncEnrollment({', 'await syncEnrollment({');
fs.writeFileSync(admFile, adm, 'utf8');
console.log('Patched admissionService.js');

// 2. paymentService.js
const payFile = path.resolve(__dirname, '../src/modules/student/services/paymentService.js');
let pay = fs.readFileSync(payFile, 'utf8');
pay = pay.replaceAll('syncEnrollment({', 'await syncEnrollment({');
fs.writeFileSync(payFile, pay, 'utf8');
console.log('Patched paymentService.js');

