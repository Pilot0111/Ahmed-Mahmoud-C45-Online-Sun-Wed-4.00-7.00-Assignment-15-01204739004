import * as z from "zod";
import { Types } from "mongoose";
import en from "zod/v4/locales/en.js";




export const generalRoles= {
    id: z.string().refine((val) => Types.ObjectId.isValid(val), {
      message: "Invalid ObjectId",
    }),
   file: z.object({
    fileName: z.string(),
    originalName: z.string(),
    encoding: z.string(),
    mimetype: z.string(),
    buffer: z.any().optional(),
    size: z.number(),
    path: z.string().optional(),
   
   }),
  }
