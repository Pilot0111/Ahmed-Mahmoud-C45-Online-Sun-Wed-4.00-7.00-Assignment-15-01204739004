import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { AppError } from "../utils/global-error-handler";
import { GraphQLError } from "graphql";

type reqType = keyof Request;
type schemaType = Partial<Record<reqType, ZodType>>;

export const Validation = (schema: schemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationErrors: string[] = [];
    for (const key of Object.keys(schema) as reqType[]) {
      const currentSchema = schema[key];
      if (!currentSchema) continue;
      if (req?.file){
       req.body.file = req.file;
      }
      if (req?.files){
        req.body.files = req.files;
      }

      const result = currentSchema.safeParse(req[key]);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          validationErrors.push(`${String(key)}.${issue.path.join(".")}: ${issue.message}`);
        });
      }
    }
    if (validationErrors.length > 0) {
      return next(new AppError(validationErrors.join(", "), 400));
    }
    next();
  };
};

export const Validation_GQL = async (schema: ZodType, data: any) => {
  const errorValidation: any[] = [];

  const result = await schema.safeParseAsync(data);

  if (!result?.success) {
    const errors = result.error.issues.map((err: any) => {
      return {
        path: err.path[0],
        message: err.message,
      };
    });
    errorValidation.push(...errors);
  }

  if (errorValidation.length) {
    throw new GraphQLError("Validation failed", {
      extensions: {
        code: "BAD_REQUEST",
        status: 400,
        message: "one or more fields have validation errors",
        errors: errorValidation,
      },
    });
  }
};
