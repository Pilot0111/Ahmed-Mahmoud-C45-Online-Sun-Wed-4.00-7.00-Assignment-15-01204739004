import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  constructor(public message: any, public statusCode?: number) {
    super(message);
    this.statusCode = statusCode || 500;
    this.message = message || "An unexpected error occurred. Please try again later.";
  }
}
export const globalErrorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
     console.error(err.cause || err.message);
    const status =  err.statusCode as number || 500;
    res.status(status).json({
      message: err.message || "An unexpected error occurred. Please try again later.",
      status,
      stack: err.stack,
    });
  };