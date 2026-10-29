const mongoose = require('mongoose');
const fs = require('fs');
const env = require('../src/config/env');

const publicSlugs = [
  'space-fundamentals',
  'space-systems',
  'remote-sensing',
  'satellite-ops',
  'gnss',
  'cybersecurity',
  'mission-design',
  'electronics-training-pending',
];

async function check() {
  const conn = mongoose.createConnection(env.db.studentUri);
  await new Promise(r => conn.once('connected', r));
  const courses = await conn.db.collection('courses').find({}).toArray();

  console.log(`Total DB courses: ${courses.length}`);

  for (const slug of publicSlugs) {
    const match = courses.find(c => c.slug === slug || (c.slug && c.slug.includes(slug)) || (c.title && c.title.toLowerCase().includes(slug.replace(/-/g, ' '))));
    if (match) {
      console.log(`MATCH: slug "${slug}" -> DB Course: "${match.title}" (slug: ${match.slug}) | Price: ${match.price} | TransportPrice: ${match.transportationPrice} | Currency: ${match.currency}`);
    } else {
      console.log(`NO MATCH for slug "${slug}"`);
    }
  }

  console.log('\nSample DB courses with prices:');
  courses.filter(c => c.price != null).slice(0, 15).forEach(c => {
    console.log(`- "${c.title}" (slug: ${c.slug}) | Price: ${c.price} ${c.currency || 'EGP'} | Transport: ${c.transportationPrice}`);
  });

  await conn.close();
}

check().catch(console.error);
