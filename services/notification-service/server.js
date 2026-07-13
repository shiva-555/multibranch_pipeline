const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const SERVICE_NAME = 'notification-service';
const PORT = process.env.PORT || 3504;

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

// 🧱 Ensure Required Table Exists (this service only owns "notification")
const ensureTables = async (db) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS notification (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        posted_by VARCHAR(255),
        audience ENUM('All','Students','Teachers') NOT NULL DEFAULT 'All',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log(`✅ [${SERVICE_NAME}] Table ensured successfully (notification)`);
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

    // ---- Notification Routes ----
    app.get('/', async (req, res) => {
      try {
        const [data] = await db.query("SELECT * FROM notification ORDER BY created_at DESC");
        return res.json({ message: `From ${SERVICE_NAME}!!!`, notificationData: data });
      } catch (error) {
        console.error('Error fetching notification data:', error);
        return res.status(500).json({ error: 'Error fetching notification data' });
      }
    });

    app.get('/notification', async (req, res) => {
      try {
        const [data] = await db.query("SELECT * FROM notification ORDER BY created_at DESC");
        return res.json(data);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ error: 'Failed to fetch notifications' });
      }
    });

    app.post('/addnotification', async (req, res) => {
      try {
        const { title, message, postedBy, audience } = req.body;

        if (!title || !message) {
          return res.status(400).json({ error: 'title and message are required' });
        }

        await db.query(
          `INSERT INTO notification (title, message, posted_by, audience) VALUES (?, ?, ?, ?)`,
          [title, message, postedBy || 'Admin', audience || 'All']
        );
        return res.json({ message: 'Notification posted successfully' });
      } catch (error) {
        console.error('Error adding notification:', error);
        return res.status(500).json({ error: 'Error inserting notification data' });
      }
    });

    app.delete('/notification/:id', async (req, res) => {
      const notificationId = req.params.id;
      try {
        await db.query('DELETE FROM notification WHERE id = ?', [notificationId]);
        return res.json({ message: 'Notification deleted successfully' });
      } catch (error) {
        console.error('Error deleting notification:', error);
        return res.status(500).json({ error: 'Error deleting notification' });
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
