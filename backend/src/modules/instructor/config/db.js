const net = require('net');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('./env');

function checkTcpPort(port = 27017, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => { s.destroy(); resolve(false); });
  });
}

async function ensureLocalMongo(uri) {
  if (env.nodeEnv === 'production') return;
  if (!uri.includes('127.0.0.1:27017') && !uri.includes('localhost:27017')) return;

  const isOpen = await checkTcpPort(27017, '127.0.0.1');
  if (isOpen) return;

  const candidates = [
    process.env.MONGOD_BIN,
    'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
    'mongod',
  ].filter(Boolean);

  const scratchData = path.resolve(__dirname, '../../../scratch/mongo-data');
  const programFilesData = 'C:\\Program Files\\MongoDB\\Server\\8.2\\data';
  const dataPath = fs.existsSync(scratchData) ? scratchData : (fs.existsSync(programFilesData) ? programFilesData : null);

  for (const bin of candidates) {
    if (fs.existsSync(bin) || bin === 'mongod') {
      try {
        console.log(`[db] MongoDB is not running on 127.0.0.1:27017. Auto-starting local instance via ${bin}...`);
        const args = dataPath ? ['--dbpath', dataPath, '--port', '27017'] : ['--port', '27017'];
        const proc = cp.spawn(bin, args, { detached: true, stdio: 'ignore' });
        proc.unref();

        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 200));
          if (await checkTcpPort(27017, '127.0.0.1')) {
            console.log('[db] Local MongoDB successfully started on :27017.');
            return;
          }
        }
      } catch (err) {
        console.warn(`[db] Attempt to start ${bin} failed:`, err.message);
      }
    }
  }
}

async function connectDB(uri = env.mongoUri) {
  await ensureLocalMongo(uri);
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err) => {
    if (env.nodeEnv !== 'test') console.error('MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    if (env.nodeEnv !== 'test') console.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    if (env.nodeEnv !== 'test') console.log('MongoDB reconnected');
  });
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}
module.exports = { connectDB };

