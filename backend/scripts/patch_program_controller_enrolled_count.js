const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/modules/admin/controllers/programController.js');
let content = fs.readFileSync(file, 'utf8');

const target = `  sendSuccess(res, 200, {
    enrollments: list,
    total,
    capacity: program.capacity,
    occupiedSeats: program.occupiedSeats,
  });`;

const replacement = `  sendSuccess(res, 200, {
    enrollments: list,
    total,
    enrolledCount: total,
    capacity: program.capacity,
    occupiedSeats: program.occupiedSeats,
  });`;

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
  let patched = normContent.replace(normTarget, replacement.replace(/\r\n/g, '\n'));
  if (content.includes('\r\n')) {
    patched = patched.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync(file, patched, 'utf8');
  console.log('Successfully patched programController.js with enrolledCount');
} else {
  console.error('Target not found in programController.js');
}

