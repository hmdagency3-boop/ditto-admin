import serverlessHttp from "serverless-http";
import { createApp } from "../../server/createApp";
import type { Handler } from "@netlify/functions";

let cachedHandler: ReturnType<typeof serverlessHttp> | null = null;

export const handler: Handler = async (event, context) => {
  if (!cachedHandler) {
    const { app } = await createApp();
    cachedHandler = serverlessHttp(app);
  }
  return cachedHandler(event, context) as any;
};
