
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/global-error-handler";

export const authrization = (roles: string[] = []) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (roles.includes(req.user?.role)) {
      return next();
    }
    next(new AppError("unauthorized", 403));
  };
};
    