// cPanel Phusion Passenger Entry Point with dotenv & error diagnostics
const path = require('path');
const fs = require('fs');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  // dotenv will be available once npm install finishes
}

process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(path.join(__dirname, 'startup_error.log'), `[${new Date().toISOString()}] Uncaught: ${err.stack || err}\n`);
  } catch (e) {}
});

process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(path.join(__dirname, 'startup_error.log'), `[${new Date().toISOString()}] Rejection: ${reason.stack || reason}\n`);
  } catch (e) {}
});

require('./dist/src/main.js');
