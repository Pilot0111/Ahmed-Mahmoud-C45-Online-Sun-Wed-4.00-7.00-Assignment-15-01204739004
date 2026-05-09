import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/global-error-handler";
import { RoleEnum } from "../enum/user.enum";

export const authorization = (allowedRoles: RoleEnum[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Assuming req.user is populated by an authentication middleware
    if (!req.user || !req.user.role) {
      return next(new AppError("Not authenticated or role not found", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("Unauthorized: Insufficient permissions", 403));
    }

    next();
  };
};