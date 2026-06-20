import express, { type Request, Response, NextFunction } from "express";
import serverless from "serverless-http";
import { createServer } from "http";
import { registerRoutes } from "../../server/routes";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

const httpServer = createServer(app);

let ready = false;
const initPromise = registerRoutes(httpServer, app, { enableScheduler: false }).then(() => {
  ready = true;
});

const baseHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  if (!ready) await initPromise;
  return baseHandler(event, context);
};
