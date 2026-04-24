import { symmetricDecryption } from "../utils/security/encrypt.security";
import tokenService from "../utils/security/toke.security";
import userRepositoryInstance from "../../DB/repositories/user.repository";
import { JWT_ACCESS_SECRET_ADMIN, JWT_ACCESS_SECRET_USER, JWT_REFRESH_SECRET_ADMIN, JWT_REFRESH_SECRET_USER, PREFIX_ADMIN, PREFIX_USER } from "../../config/config.service";
import redisService from "../service/redis.service";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/global-error-handler";

export const authentication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authorization = req.get("authorization");
    if (!authorization) {
      return next(new AppError("token not found", 401));
    }
    
    const token = authorization.split(" ")[1];
    if (!token) {
      return next(new AppError("invalid received token authorization", 401));
    }
    const prefix = authorization.split(" ")[0];
    let JWT_ACCESS_SECRET: string;
    if (prefix === PREFIX_USER) {
      JWT_ACCESS_SECRET = JWT_ACCESS_SECRET_USER;
    } else if (prefix === PREFIX_ADMIN) {
      JWT_ACCESS_SECRET = JWT_ACCESS_SECRET_ADMIN;
    } else {
      return next(new AppError("invalid token prefix", 401));
    }
    const decoded: any = tokenService.verifyToken({
      token,
      secret_key: JWT_ACCESS_SECRET,
    });
    if (!decoded || !decoded?.id) {
      return next(new AppError("invalid token format", 401));
    }

    const user = await userRepositoryInstance.findOne({
      filter: { _id: decoded.id },
      projection: "-password -__v",
    });
    if (!user) {
      return next(new AppError("user not found", 404));
    }

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
      return next(new AppError("token revoked", 401));
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
