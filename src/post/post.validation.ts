import * as z from "zod";
import { Types } from "mongoose";
import { Allow_Comment_Enum, Availability_Enum, Reaction_Enum } from "../common/enum/post.enum";
import { generalRoles } from "../common/utils/general.role";

const mongoId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId",
});

export const createPostSchema = {
  body: z.object({
    content: z.string().min(1).max(5000).optional(),
    attachments: z.array(generalRoles.file).optional(),
    tags: z.array(generalRoles.id).optional(),
    allowComments: z.nativeEnum(Allow_Comment_Enum).default(Allow_Comment_Enum.allow),
    availability: z.nativeEnum(Availability_Enum).default(Availability_Enum.public),
  }).superRefine((data, ctx) => {
    if (!data.content?.trim() && (!data.attachments || data.attachments.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: "Either content or at least one attachment is required",
      });
    }
    if(data?.tags){
      const uniqueTags = new Set(data.tags);
      if (uniqueTags.size !== data.tags.length) {
        ctx.addIssue({
          code: "custom", 
          path: ["tags"],
          message: "Tags must be unique",
        });
      }
    }
  }),
};

export const updatePostSchema = {
  params: z.object({
    postId: mongoId,
  }),
  body: z.object({
    content: z.string().min(1).max(5000).optional(),
    attachments: z.array(generalRoles.file).optional(),
    removeFiles: z.array(z.string()).optional(),
    tags: z.array(generalRoles.id).optional(),
    removeTags: z.array(generalRoles.id).optional(),
    allowComments: z.nativeEnum(Allow_Comment_Enum).default(Allow_Comment_Enum.allow),
    availability: z.nativeEnum(Availability_Enum).default(Availability_Enum.public),
  }).superRefine((data, ctx) => {
    if (!data.content?.trim() && (!data.attachments || data.attachments.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: "Either content or at least one attachment is required",
      });
    }
    if (data?.tags) {
      const uniqueTags = new Set(data.tags);
      if (uniqueTags.size !== data.tags.length) {
        ctx.addIssue({
          code: "custom",
          path: ["tags"],
          message: "Tags must be unique",
        });
      }
    }
  }),
};

export const reactPostSchema = {
  params: z.object({
    postId: mongoId,
  }),
  body: z.object({
    reaction: z.nativeEnum(Reaction_Enum),
  }),
};

export const postIdSchema = {
  params: z.object({
    postId: mongoId,
  }),
};

export type ICreatePostType = z.infer<typeof createPostSchema.body>;
export type IUpdatePostType = z.infer<typeof updatePostSchema.body>;
export type IPostIdType = z.infer<typeof postIdSchema.params>;
