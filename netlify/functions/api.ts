import express, { type Request, Response, NextFunction } from "express";
import serverless from "serverless-http";
import { createServer } from "http";
import { registerRoutes } from "../../platform-admin/server/routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const httpServer = createServer(app);

registerRoutes(httpServer, app, { enableScheduler: false });

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

export const handler = serverless(app);
