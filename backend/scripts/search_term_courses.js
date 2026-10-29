const mongoose = require('mongoose');
const env = require('../src/config/env');

async function searchCourses() {
  const conn = mongoose.createConnection(env.db.studentUri);
  await new Promise(r => conn.once('connected', r));
  const courses = await conn.db.collection('courses').find({}).toArray();

  const terms = ['gnss', 'remote', 'sensing', 'operation', 'mission', 'design', 'cubesat', 'telemetry', 'electronic'];
  for (const term of terms) {
    console.log(`=== Matches for "${term}" ===`);
    const matches = courses.filter(c => c.title.toLowerCase().includes(term) || (c.slug && c.slug.includes(term)));
    matches.forEach(c => {
      console.log(`  "${c.title}" | slug: ${c.slug} | price: ${c.price} | transport: ${c.transportationPrice}`);
    });
  }

  await conn.close();
}

searchCourses().catch(console.error);

