const mongoose = require('mongoose');
const env = require('../src/config/env');

async function listAllCoursePrices() {
  const conn = mongoose.createConnection(env.db.studentUri);
  await new Promise(r => conn.once('connected', r));
  const courses = await conn.db.collection('courses').find({}).toArray();

  console.log(`Total courses in DB: ${courses.length}`);
  
  // Group by tracks or list all
  courses.forEach(c => {
    if (c.price !== undefined || c.transportationPrice !== undefined) {
      console.log(`- "${c.title}" | slug: "${c.slug}" | price: ${c.price} | transport: ${c.transportationPrice} | curr: ${c.currency}`);
    }
  });

  await conn.close();
}

listAllCoursePrices().catch(console.error);

