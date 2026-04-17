import { symmetricDecryption } from "../utils/security/encrypt.security";
import { verifyToken } from "../utils/security/toke.security";
import userModel from "../../DB/models/user.model";
import { JWT_ACCESS_SECRET, PREFIX } from "../../config/config.service";
import { generateRevokeTokenKey, get } from "../../DB/redis/redis.service";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/global-error-handler";

export const authentication = async (req: any, res: Response, next: NextFunction) => {
  try {
  const { authorization } = req.headers;
  if (!authorization) {
    return next(new AppError("token not found", 401));
  }
  if (!authorization.startsWith(PREFIX + " ")) {
    return next(new AppError("invalid token", 401));
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return next(new AppError("invalid token", 401));
  }
  const decoded: any = verifyToken({ token, signature: JWT_ACCESS_SECRET });
  if (!decoded || !decoded?.id) {
    return next(new AppError("invalid token", 401));
  }

  const user = await (userModel as any).findById(decoded.id).select("-password -__v");
  if (!user) {
    return next(new AppError("user not found", 404));
  }

  const isRevoked = await get({ key: generateRevokeTokenKey(user._id.toString(), decoded.jti) });
  if (isRevoked) {
    return next(new AppError("token revoked", 401));
  }

  const decryptedPhone = user.phone ? symmetricDecryption(user.phone) : null;

  req.user = {
    ...user.toObject(),
    phone: decryptedPhone,
  };
  req.decoded = decoded;

  next();
  } catch (error) {
    next(error);
  }
};
