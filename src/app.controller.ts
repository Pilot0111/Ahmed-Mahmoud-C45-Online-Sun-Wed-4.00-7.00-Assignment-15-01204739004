import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PORT } from "./config/config.service";
import {
  AppError,
  globalErrorHandler,
} from "./common/utils/global-error-handler";
import { connectRedis } from "./DB/redis/redis.db";
import authRouter from "./auth/user.controller";
import { checkConnectionDB } from "./DB/connectionDB";
const app: express.Application = express();
const port: number = Number(PORT);
const bootstrap = () => {
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
      console.log(
        `${options.message} - IP: ${req.ip} - Time: ${new Date().toISOString()}`,
      );
      throw new AppError(options.message || "Too many requests", 429);
    },
  });
  app.use(express.json());
  app.use(cors(), helmet(), limiter);

  app.get("/", (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({
      message: "Welcome to Social Media APP ......:)",
      info: "This is the root route. Use /api for API endpoints.",
    });
  });
  connectRedis();
  checkConnectionDB();
  app.use("/auth", authRouter);

  app.use( (req: Request, res: Response, next: NextFunction)=> {
    throw new AppError(
      `The route ${req.originalUrl} you are trying to access with method ${req.method} does not exist. Please check the URL and try again.`,
      404,
    );
  });
  app.use(globalErrorHandler);

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

export default bootstrap;
