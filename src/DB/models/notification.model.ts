import mongoose, { Schema, Types } from "mongoose";

export interface INotification {
  title: string;
  body: string;
  sendTo?: Types.ObjectId | null; // If null, it's a global announcement
  createdBy: Types.ObjectId;
  isRead: boolean;
}

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    sendTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const notificationModel =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", notificationSchema);
export default notificationModel;