import * as z from "zod";
import { Types } from "mongoose";
import { generalRoles } from "../common/utils/general.role";

const mongoId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId",
});

export const createStorySchema = {
  body: z.object({
    content: z.string().min(1).max(500).optional(),
    image: z.string().url().optional(), // Assuming image is a URL after S3 upload
  }).superRefine((data, ctx) => {
    if (!data.content && !data.image) {
      ctx.addIssue({
        code: "custom",
        message: "Either content or an image is required for a story",
      });
    }
  }),
};

export const storyIdSchema = {
  params: z.object({
    storyId: mongoId,
  }),
};

export type ICreateStoryType = z.infer<typeof createStorySchema.body>;