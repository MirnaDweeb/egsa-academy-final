const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const env = require('../src/config/env');

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

async function runBackup() {
  const timestamp = getTimestamp();
  const backupDirName = `backup_${timestamp}`;
  const backupRoot = path.resolve(__dirname, '../../backups', backupDirName);

  console.log(`[Backup] Starting backup to: ${backupRoot}`);
  fs.mkdirSync(backupRoot, { recursive: true });

  const connections = [
    { name: 'egsa_academy', uri: env.db.studentUri },
    { name: 'egsa_instructor', uri: env.db.instructorUri },
    { name: 'esa_academy', uri: env.db.adminUri },
  ];

  const manifest = {
    timestamp: new Date().toISOString(),
    backupDirectory: backupRoot,
    databases: {},
    verified: false,
    totalDocuments: 0,
    totalFiles: 0,
  };

  for (const { name, uri } of connections) {
    console.log(`\n[Backup] Connecting to ${name}...`);
    const conn = mongoose.createConnection(uri);
    await new Promise((resolve) => conn.once('connected', resolve));

    const dbDir = path.join(backupRoot, name);
    fs.mkdirSync(dbDir, { recursive: true });

    const collections = await conn.db.listCollections().toArray();
    manifest.databases[name] = {
      collections: {},
      totalDocuments: 0,
    };

    console.log(`[Backup] Exporting ${collections.length} collections from ${name}...`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const col = conn.db.collection(colName);
      const docs = await col.find({}).toArray();
      const count = docs.length;

      // Get indexes
      let indexes = [];
      try {
        indexes = await col.indexes();
      } catch (err) {
        console.warn(`  Warning: Could not get indexes for ${colName}:`, err.message);
      }

      // Write data file using EJSON (extended JSON preserving ObjectIDs, Dates, etc.)
      const dataFilePath = path.join(dbDir, `${colName}.json`);
      const serializedData = EJSON.stringify(docs, null, 2);
      fs.writeFileSync(dataFilePath, serializedData, 'utf8');

      // Write metadata file
      const metaFilePath = path.join(dbDir, `${colName}.metadata.json`);
      fs.writeFileSync(
        metaFilePath,
        JSON.stringify({ name: colName, indexes, options: colInfo.options || {} }, null, 2),
        'utf8'
      );

      const stats = fs.statSync(dataFilePath);

      manifest.databases[name].collections[colName] = {
        count,
        sizeBytes: stats.size,
        dataFile: path.basename(dataFilePath),
        metaFile: path.basename(metaFilePath),
      };

      manifest.databases[name].totalDocuments += count;
      manifest.totalDocuments += count;
      manifest.totalFiles += 2;

      console.log(`  ✓ ${colName.padEnd(25)} : ${String(count).padStart(4)} docs (${stats.size} bytes)`);
    }

    await conn.close();
  }

  // Verification step
  console.log('\n[Backup] Verifying backup integrity...');
  let verificationPassed = true;
  const verificationErrors = [];

  for (const [dbName, dbData] of Object.entries(manifest.databases)) {
    const dbDir = path.join(backupRoot, dbName);
    for (const [colName, colData] of Object.entries(dbData.collections)) {
      const dataPath = path.join(dbDir, colData.dataFile);
      const metaPath = path.join(dbDir, colData.metaFile);

      if (!fs.existsSync(dataPath)) {
        verificationErrors.push(`Missing data file: ${dataPath}`);
        verificationPassed = false;
        continue;
      }

      if (!fs.existsSync(metaPath)) {
        verificationErrors.push(`Missing meta file: ${metaPath}`);
        verificationPassed = false;
        continue;
      }

      const stat = fs.statSync(dataPath);
      if (colData.count > 0 && stat.size === 0) {
        verificationErrors.push(`Empty file for non-empty collection ${dbName}.${colName}`);
        verificationPassed = false;
        continue;
      }

      // Verify file parse and doc count
      try {
        const content = fs.readFileSync(dataPath, 'utf8');
        const parsed = EJSON.parse(content);
        if (parsed.length !== colData.count) {
          verificationErrors.push(`Count mismatch in ${dbName}.${colName}: expected ${colData.count}, got ${parsed.length}`);
          verificationPassed = false;
        }
      } catch (err) {
        verificationErrors.push(`Failed to parse backup file ${dataPath}: ${err.message}`);
        verificationPassed = false;
      }
    }
  }

  if (!verificationPassed) {
    console.error('\n❌ Backup verification FAILED:');
    verificationErrors.forEach((e) => console.error(`  - ${e}`));
    throw new Error('Backup verification failed! Aborting.');
  }

  manifest.verified = true;
  const manifestPath = path.join(backupRoot, 'backup_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n========================================');
  console.log('BACKUP VERIFIED AND COMPLETE');
  console.log('========================================');
  console.log(`Directory: ${backupRoot}`);
  console.log(`Total Documents: ${manifest.totalDocuments}`);
  console.log(`Total Files Written: ${manifest.totalFiles + 1}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log('========================================\n');

  return { backupRoot, manifest };
}

if (require.main === module) {
  runBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal backup error:', err);
      process.exit(1);
    });
}

module.exports = { runBackup };

