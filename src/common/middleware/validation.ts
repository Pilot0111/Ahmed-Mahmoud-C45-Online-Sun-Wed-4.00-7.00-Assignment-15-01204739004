import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { AppError } from "../utils/global-error-handler";

type reqType = keyof Request;
type schemaType = Partial<Record<reqType, ZodType>>;

export const Validation = (schema: schemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationErrors: string[] = [];
    for (const key of Object.keys(schema) as reqType[]) {
      if (!schema[key]) continue;
      const result = schema[key].safeParse(req[key]);
      if (!result.success) {
        validationErrors.push(result.error.message);
      }
    }
    if (validationErrors.length > 0) {
      return next(new AppError(validationErrors.join(", "), 400));
    }
    next();
  };
};
