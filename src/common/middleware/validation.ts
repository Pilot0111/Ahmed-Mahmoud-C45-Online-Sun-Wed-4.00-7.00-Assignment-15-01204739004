import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { AppError } from "../utils/global-error-handler";

type reqType = keyof Request;
type schemaType = Partial<Record<reqType, ZodType>>;

export const Validation = (schema: schemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationErrors: string[] = [];
    for (const key of Object.keys(schema) as reqType[]) {
      const currentSchema = schema[key];
      if (!currentSchema) continue;

      const result = currentSchema.safeParse(req[key]);
      if (!result.success) {
        result.error.issues.forEach((issue) => validationErrors.push(issue.message));
      }
    }
    if (validationErrors.length > 0) {
      return next(new AppError(validationErrors.join(", "), 400));
    }
    next();
  };
};
