import { symmetricDecryption } from "../utils/security/encrypt.security";
import tokenService from "../utils/security/toke.security";
import userRepositoryInstance from "../../DB/repositories/user.repository";
import { JWT_ACCESS_SECRET_ADMIN, JWT_ACCESS_SECRET_USER, JWT_REFRESH_SECRET_ADMIN, JWT_REFRESH_SECRET_USER, PREFIX_ADMIN, PREFIX_USER } from "../../config/config.service";
import redisService from "../service/redis.service";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/global-error-handler";
import { Socket } from "socket.io";

export const authentication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let authorization = req.get("authorization");

    // Support tokens in query parameters for requests that cannot send headers (like <img> tags)
    if (!authorization && req.query.token && req.query.prefix) {
      authorization = `${req.query.prefix} ${req.query.token}`;
    }

    if (!authorization) {
      return next(new AppError("Authentication error: Token missing", 401));
    }
    
    // Split the header by whitespace to separate prefix and token
    const parts = authorization.trim().split(/\s+/);

    if (parts.length !== 2) {
      return next(new AppError("Authentication error: Invalid header format. Use '{Prefix} {Token}'", 401));
    }

    const [prefix, token] = parts;
    if (!token) {
      return next(new AppError("Authentication error: Token missing", 401));
    }

    let JWT_ACCESS_SECRET: string;
    if (prefix === PREFIX_USER) {
      JWT_ACCESS_SECRET = JWT_ACCESS_SECRET_USER;
    } else if (prefix === PREFIX_ADMIN) {
      JWT_ACCESS_SECRET = JWT_ACCESS_SECRET_ADMIN;
    } else {
      return next(new AppError("Authentication error: Invalid prefix", 401));
    }
    const decoded: any = tokenService.verifyToken({
      token,
      secret_key: JWT_ACCESS_SECRET,
    });
    if (!decoded || !decoded?.id) {
      return next(new AppError("Authentication error: Invalid token format", 401));
    }

    const user = await userRepositoryInstance.findOne({
      filter: { _id: decoded.id },
      projection: "-password -__v",
    });
    if (!user) {
      return next(new AppError("Authentication error: User not found", 401));
    }

    // Populate friends with source fields for the userName virtual
    await user.populate({ 
      path: "friends", 
      select: "profilePicture firstName lastName" 
    });

    if (!user.confirmed) {
      return next(
        new AppError("Please confirm your email to access this resource", 403),
      );
    }

    const isRevoked = await redisService.get({
      key: redisService.generateRevokeTokenKey(
        user._id.toString(),
        decoded.jti,
      ),
    });
    if (isRevoked) {
      return next(new AppError("Authentication error: Token revoked", 401));
    }

    const decryptedPhone = user.phone ? symmetricDecryption(user.phone) : null;

    user.phone = decryptedPhone; // Directly modify the document's phone property
    req.user = user; // Assign the modified HydratedDocument
    req.decoded = decoded;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Socket.IO Connection Middleware
 * Verifies the JWT token sent in the handshake auth object.
 */
export const socketIOauth = async (socket: Socket, next: (err?: any) => void) => {
  try {
    const authHeader = socket.handshake.auth?.authorization;
    if (!authHeader) {
      return next(new AppError("Authentication error: Token missing", 401));
    }

    // Robust splitting to handle various whitespace or formats
    const authParts = authHeader.trim().split(/\s+/);
    if (authParts.length !== 2) {
      return next(new AppError("Authentication error: Invalid header format. Use '{Prefix} {Token}'", 401));
    }

    const [prefix, token] = authParts;
    let secret: string;

    if (prefix === PREFIX_USER) {
      secret = JWT_ACCESS_SECRET_USER;
    } else if (prefix === PREFIX_ADMIN) {
      secret = JWT_ACCESS_SECRET_ADMIN;
    } else {
      return next(new AppError("Authentication error: Invalid prefix", 401));
    }

    const decoded: any = tokenService.verifyToken({
      token,
      secret_key: secret,
    });
    
    if (!decoded || !decoded?.id) {
      return next(new AppError("Authentication error: Invalid token format", 401));
    }

    // Fetch user without sensitive fields to keep the socket object lightweight
    const user = await userRepositoryInstance.findOne({
      filter: { _id: decoded.id },
      projection: "-password -__v",
    });

    if (!user) {
      return next(new AppError("Authentication error: User not found", 401));
    }

    // Populate friends for socket data as well
    await user.populate({ 
      path: "friends", 
      select: "profilePicture firstName lastName" 
    });

    if (!user.confirmed) {
      return next(
        new AppError("Please confirm your email to access this resource", 403),
      );
    }

    const isRevoked = await redisService.get({
      key: redisService.generateRevokeTokenKey(
        user._id.toString(),
        decoded.jti,
      ),
    });
    if (isRevoked) {
      return next(new AppError("Authentication error: Token revoked", 401));
    }

    const decryptedPhone = user.phone ? symmetricDecryption(user.phone) : null;
    user.phone = decryptedPhone;

    socket.data.user = user;
    socket.data.decoded = decoded;
    next();
  } catch (error: any) {
    console.error("[BACKEND] 🔐 Socket Auth Failed:", error.message);
    next(error instanceof AppError ? error : new Error("Authentication failed"));
  }
};
