import * as z from "zod";
import { Types } from "mongoose";
import { generalRoles } from "../common/utils/general.role";

const mongoId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId",
});

export const createCommentSchema = {
  params: z.object({
    postId: mongoId,
  }),
  body: z.object({
    content: z.string().min(1).max(2000),
    tags: z.array(generalRoles.id).optional(),
  }),
};

export const commentIdSchema = {
  params: z.object({
    commentId: mongoId,
  }),
};