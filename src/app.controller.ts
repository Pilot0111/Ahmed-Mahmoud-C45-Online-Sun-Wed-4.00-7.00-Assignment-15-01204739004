import express, { NextFunction, Request, Response } from "express";
import { createServer } from "node:http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { 
  PORT, 
} from "./config/config.service";
import {
  AppError,
  globalErrorHandler,
} from "./common/utils/global-error-handler"; 
import authRouter from "./modules/auth/user.controller";
import { checkConnectionDB } from "./DB/connectionDB";
import storyRouter from "./modules/story/story.controller";
import redisService from "./common/service/redis.service";
import postRouter from "./modules/post/post.controller";
import notificationRouter from "./modules/notifications/notification.controller";
import socketGateway from "./modules/realtime/socket.gateway";

import { createHandler } from "graphql-http/lib/use/express";
import { gql_schema } from "./modules/graphQl/graphQl.schema";

const app: express.Application = express();

const port: number = Number(PORT);
const bootstrap = async () => {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message:
      "Too many requests from this IP, please try again after 15 minutes",
    handler: (
      req: Request,
      res: Response,
      next: NextFunction,
      options: any,
    ) => {
      console.log(`[BACKEND] 🚨 Rate Limit: ${options.message} | IP: ${req.ip} | Time: ${new Date().toISOString()}`);
      throw new AppError(options.message || "Too many requests", 429);
    },
  });
  app.use(express.json());
  app.use(cors());
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(limiter);

  app.get("/", (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({
      message: "Welcome to Social Media APP ......:)",
      info: "This is the root route. Use /api for API endpoints.",
    });
  });
  checkConnectionDB();
  await redisService.connect();
  app.use("/auth", authRouter);
  app.use("/posts", postRouter);
  app.use("/stories", storyRouter);
  app.use("/notifications", notificationRouter);

  app.use(
    "/graphql",
    createHandler({
      schema: gql_schema,
      context: (req: any) => ({ req }),
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    throw new AppError(
      `The route ${req.originalUrl} you are trying to access with method ${req.method} does not exist. Please check the URL and try again.`,
      404,
    );
  });
  app.use(globalErrorHandler);

  const httpServer = createServer(app);

  // Initialize Socket Gateway to handle events and namespaces
  socketGateway.initIo(httpServer);

  httpServer.listen(port, () => {
    console.log(`[BACKEND] 🚀 Server is live on port ${port}`);
  });
};

export default bootstrap;
