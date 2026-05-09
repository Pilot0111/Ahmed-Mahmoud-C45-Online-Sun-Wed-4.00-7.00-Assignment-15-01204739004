import * as z from "zod";
import { Types } from "mongoose";
import { generalRoles } from "../common/utils/general.role";

const mongoId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId",
});

export const createNotificationSchema = {
  body: z.object({
    title: z.string().min(1).max(255),
    body: z.string().min(1).max(1000),
    sendTo: mongoId.optional(), // Optional: if provided, send to specific user; otherwise, global
  }),
};

export const notificationIdSchema = {
  params: z.object({
    notificationId: mongoId,
  }),
};

export type ICreateNotificationType = z.infer<typeof createNotificationSchema.body>;