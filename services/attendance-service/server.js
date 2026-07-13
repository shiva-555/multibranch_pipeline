const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const SERVICE_NAME = 'attendance-service';
const PORT = process.env.PORT || 3503;

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

// 🧱 Ensure Required Table Exists (this service only owns "attendance")
const ensureTables = async (db) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_name VARCHAR(255) NOT NULL,
        roll_number VARCHAR(255),
        class VARCHAR(255),
        attendance_date DATE NOT NULL,
        status ENUM('Present','Absent','Late') NOT NULL DEFAULT 'Present',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log(`✅ [${SERVICE_NAME}] Table ensured successfully (attendance)`);
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

    // ---- Attendance Routes ----
    app.get('/', async (req, res) => {
      try {
        const [data] = await db.query("SELECT * FROM attendance ORDER BY attendance_date DESC, id DESC");
        return res.json({ message: `From ${SERVICE_NAME}!!!`, attendanceData: data });
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        return res.status(500).json({ error: 'Error fetching attendance data' });
      }
    });

    // Optional filter: /attendance?date=YYYY-MM-DD or /attendance?class=10A
    app.get('/attendance', async (req, res) => {
      try {
        const { date, class: className } = req.query;
        let query = 'SELECT * FROM attendance WHERE 1=1';
        const params = [];

        if (date) {
          query += ' AND attendance_date = ?';
          params.push(date);
        }
        if (className) {
          query += ' AND class = ?';
          params.push(className);
        }
        query += ' ORDER BY attendance_date DESC, id DESC';

        const [data] = await db.query(query, params);
        return res.json(data);
      } catch (error) {
        console.error('Error fetching attendance:', error);
        return res.status(500).json({ error: 'Failed to fetch attendance' });
      }
    });

    app.post('/addattendance', async (req, res) => {
      try {
        const { studentName, rollNo, class: className, date, status } = req.body;

        if (!studentName || !date) {
          return res.status(400).json({ error: 'studentName and date are required' });
        }

        await db.query(
          `INSERT INTO attendance (student_name, roll_number, class, attendance_date, status) VALUES (?, ?, ?, ?, ?)`,
          [studentName, rollNo || null, className || null, date, status || 'Present']
        );
        return res.json({ message: 'Attendance recorded successfully' });
      } catch (error) {
        console.error('Error adding attendance:', error);
        return res.status(500).json({ error: 'Error inserting attendance data' });
      }
    });

    app.delete('/attendance/:id', async (req, res) => {
      const attendanceId = req.params.id;
      try {
        await db.query('DELETE FROM attendance WHERE id = ?', [attendanceId]);
        return res.json({ message: 'Attendance record deleted successfully' });
      } catch (error) {
        console.error('Error deleting attendance record:', error);
        return res.status(500).json({ error: 'Error deleting attendance record' });
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
