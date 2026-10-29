const { getStudentConn } = require('../src/config/database');

async function run() {
  const sConn = getStudentConn();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const users = await sConn.db.collection('users').find({ role: 'student' }).toArray();
  console.log(`Found ${users.length} student users in egsa_academy.`);

  for (const user of users) {
    const profile = await sConn.db.collection('studentprofiles').findOne({ user: user._id });
    
    // Determine division
    let division = user.division || profile?.division;
    if (!division || division === 'undefined') {
      const email = (user.email || '').toLowerCase();
      const uni = (profile?.university || '').toLowerCase();
      const fac = (profile?.faculty || '').toLowerCase();
      
      if (
        email.includes('stem') ||
        email.includes('cadet') ||
        uni.includes('stem') ||
        uni.includes('school') ||
        fac.includes('stem')
      ) {
        division = 'PRE_UNIVERSITY';
      } else {
        division = 'UNIVERSITY';
      }
    }

    // Update user
    await sConn.db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          division,
          isActive: user.isActive !== false,
          accountStatus: user.accountStatus || 'active',
        },
      }
    );

    // Update profile
    const instName = profile?.institution || profile?.university || (division === 'PRE_UNIVERSITY' ? 'STEM Academy' : 'Egyptian Space Academy');
    await sConn.db.collection('studentprofiles').updateOne(
      { user: user._id },
      {
        $set: {
          division,
          institution: instName,
          university: profile?.university || instName,
        },
      },
      { upsert: false }
    );

    console.log(`Updated ${user.email} -> division: ${division}`);
  }

  console.log('Backfill completed successfully.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});
