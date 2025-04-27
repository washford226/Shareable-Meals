import express, { Request, Response, NextFunction } from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import routes from './routes';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Create a connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Middleware to attach the database pool to the request object
app.use((req: Request, res: Response, next: NextFunction) => {
  (req as any).db = db;
  next();
});

app.use(bodyParser.json()); // Parse incoming JSON data

// Use the routes defined in routes.ts
app.use('/', routes);

// Starts the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  try {
    await db.getConnection();
    console.log("Connected to MySQL database.");
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error("Database connection failed: ", err);
    process.exit(1); // Exit the process with failure
  }
});
