const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const SERVICE_NAME = 'student-service';
const PORT = process.env.PORT || 3501;

let db;

// 🔁 MySQL Connection with Retry Logic (same DB used by all services)
const connectWithRetry = async (retries = 10, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const pool = await mysql.createPool({
        host: process.env.host,
        user: process.env.user,
        password: process.env.password,
        database: process.env.database,
        connectionLimit: 10,
        ssl: { rejectUnauthorized: false }
      });
      console.log(`✅ [${SERVICE_NAME}] Connected to MySQL (Attempt ${attempt})`);
      return pool;
    } catch (error) {
      console.error(`❌ [${SERVICE_NAME}] MySQL connection failed (Attempt ${attempt}/${retries}):`, error.message);
      if (attempt === retries) throw error;
      console.log(`Retrying in ${delay / 1000}s...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

// 🧱 Ensure Required Table Exists (this service only owns "student")
const ensureTables = async (db) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS student (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        roll_number VARCHAR(255),
        class VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log(`✅ [${SERVICE_NAME}] Table ensured successfully (student)`);
  } catch (error) {
    console.error(`❌ [${SERVICE_NAME}] Error ensuring tables:`, error);
    throw error;
  }
};

(async () => {
  try {
    db = await connectWithRetry();
    await ensureTables(db);

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('SIGINT', async () => {
      console.log(`\n🛑 [${SERVICE_NAME}] Closing MySQL pool...`);
      await db.end();
      process.exit(0);
    });

    const getLastStudentID = async () => {
      const [result] = await db.query('SELECT MAX(id) AS lastID FROM student');
      return result[0].lastID || 0;
    };

    // ---- Health Check Routes ----
    app.get('/health', (req, res) => {
      return res.status(200).json({
        status: 'ok',
        service: SERVICE_NAME,
        uptime: process.uptime()
      });
    });

    app.get('/health/db', async (req, res) => {
      try {
        const [rows] = await db.query('SELECT 1 as db_up');
        return res.status(200).json({
          status: 'ok',
          database: 'connected',
          host: process.env.host,
          database_name: process.env.database,
          result: rows[0]
        });
      } catch (error) {
        console.error('DB health check failed:', error.message);
        return res.status(500).json({
          status: 'error',
          database: 'down',
          error: error.message
        });
      }
    });

    // ---- Student Routes ----
    app.get('/', async (req, res) => {
      try {
        const [data] = await db.query("SELECT * FROM student");
        return res.json({ message: `From ${SERVICE_NAME}!!!`, studentData: data });
      } catch (error) {
        console.error('Error fetching student data:', error);
        return res.status(500).json({ error: 'Error fetching student data' });
      }
    });

    app.get('/student', async (req, res) => {
      try {
        const [data] = await db.query("SELECT * FROM student");
        return res.json(data);
      } catch (error) {
        console.error('Error fetching students:', error);
        return res.status(500).json({ error: 'Failed to fetch students' });
      }
    });

    app.post('/addstudent', async (req, res) => {
      try {
        const lastStudentID = await getLastStudentID();
        const nextStudentID = lastStudentID + 1;
        const { name, rollNo, class: className } = req.body;

        await db.query(
          `INSERT INTO student (id, name, roll_number, class) VALUES (?, ?, ?, ?)`,
          [nextStudentID, name, rollNo, className]
        );
        return res.json({ message: 'Student added successfully' });
      } catch (error) {
        console.error('Error adding student:', error);
        return res.status(500).json({ error: 'Error inserting student data' });
      }
    });

    app.delete('/student/:id', async (req, res) => {
      const studentId = req.params.id;
      try {
        await db.query('DELETE FROM student WHERE id = ?', [studentId]);
        const [rows] = await db.query('SELECT id FROM student ORDER BY id');
        await Promise.all(
          rows.map((row, index) =>
            db.query('UPDATE student SET id = ? WHERE id = ?', [index + 1, row.id])
          )
        );
        return res.json({ message: 'Student deleted successfully' });
      } catch (error) {
        console.error('Error deleting student:', error);
        return res.status(500).json({ error: 'Error deleting student' });
      }
    });

    app.listen(PORT, () => {
      console.log(`🚀 [${SERVICE_NAME}] Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error(`❌ [${SERVICE_NAME}] Fatal: Could not start server. DB connection failed.`, error);
    process.exit(1);
  }
})();
