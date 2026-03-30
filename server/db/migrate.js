require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const sql = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf8');

pool.query(sql).then(() => {
  pool.end();
}).catch((err) => {
  if (err && Array.isArray(err.errors) && err.errors.length) {
    console.error(err.errors.map((item) => item.message).join(' | '));
  } else if (err && err.message) {
    console.error(err.message);
  } else {
    console.error('Database migration failed');
  }
  pool.end();
  process.exit(1);
});
