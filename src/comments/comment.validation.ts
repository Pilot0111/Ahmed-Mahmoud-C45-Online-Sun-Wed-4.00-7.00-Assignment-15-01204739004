import * as z from "zod";
import { Types } from "mongoose";
import { generalRoles } from "../common/utils/general.role";

const mongoId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId",
});

export const addCommentSchema = {
  params: z.object({
    postId: mongoId,
    commentId: mongoId.optional(),
  }),
  body: z.object({
    content: z.string().min(1).max(2000).optional(), // Made optional to align with schema's conditional requirement
    mentions: z.array(generalRoles.id).optional(), // Changed from 'tags' to 'mentions'
  }),
};

export const commentIdSchema = {
  params: z.object({
    commentId: mongoId,
  }),
};

export const updateCommentSchema = {
  params: z.object({
    commentId: mongoId,
  }),
  body: z.object({
    content: z.string().min(1).max(2000).optional(),
    mentions: z.array(generalRoles.id).optional(),
    removeMentions: z.array(generalRoles.id).optional(),
    removeFiles: z.array(z.string()).optional(),
  }),
};

export type IUpdateCommentType = z.infer<typeof updateCommentSchema.body>;