import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import url from 'url';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in the environment variables');
}

const parsedUrl = new url.URL(databaseUrl);

const hostName = parsedUrl.hostname;
const userName = parsedUrl.username;
const password = parsedUrl.password;
const databaseName = parsedUrl.pathname.substr(1);

let finalHostName = hostName;
if (process.env.DEV_MODE === 'false' && finalHostName === 'localhost') {
  finalHostName = 'host.docker.internal';
}

const pool = mysql.createPool({
  connectionLimit: 10,
  host: finalHostName,
  user: userName,
  password: password,
  database: databaseName,
  charset: 'utf8mb4',
  timezone: 'Z',
  ssl: {
    rejectUnauthorized: false,
  },
});

pool
  .getConnection()
  .then((conn) => {
    conn.release();
    console.log('Successfully connected to the database ...');
  })
  .catch((err) => {
    console.error('Something went wrong connecting to the database ...', err);
  });

export default pool;