import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PORT } from "./config/config.service";
import {
  AppError,
  globalErrorHandler,
} from "./common/utils/global-error-handler";
import authRouter from "./auth/user.controller";
import { checkConnectionDB } from "./DB/connectionDB";
import storyRouter from "./story/story.controller";
import redisService from "./common/service/redis.service";
import postRouter from "./post/post.controller";
import notificationRouter from "./notifications/notification.controller";
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
} from "graphql";
import { createHandler } from "graphql-http/lib/use/express";
import userRepository from "./DB/repositories/user.repository";

const app: express.Application = express();

/**
 * Define the User Type for GraphQL
 */
const UserType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: { type: GraphQLString, resolve: (parent) => parent._id.toString() },
    userName: { type: GraphQLString },
    email: { type: GraphQLString },
  },
});

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
  checkConnectionDB();
  await redisService.connect();
  app.use("/auth", authRouter);
  app.use("/posts", postRouter);
  app.use("/stories", storyRouter);
  app.use("/notifications", notificationRouter);

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "RootQueryType",
      fields: {
        hello: {
          type: GraphQLString,
          resolve: () => "Hello world",
        },
        getUser: {
          type: UserType,
          args: {
            id: { type: new GraphQLNonNull(GraphQLString) },
          },
          resolve: async (parent, args) => {
            console.log(args);
            let user = await userRepository.findById(args.id);
            if (!user) {
              throw new AppError("User not found", 404);
            }
            return user;
          },
        },
        listUsers: {
          type: new GraphQLList(UserType),
          resolve: async () => {
            return await userRepository.find({ filter: {} });
          },
        },
      },
    }), // end of query
  });

  app.use(
    "/graphql",
    createHandler({
      schema,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
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
