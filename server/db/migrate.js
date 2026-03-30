require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const sql = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf8');

pool.query(sql).then(() => {
  pool.end();
}).catch((err) => {
  console.error(err.message);
  pool.end();
  process.exit(1);
});
