import mongoose, { Schema, Types } from "mongoose";

interface IMessage {
  createdBy: Types.ObjectId;
  content: string;
}

export interface IChat {
  // One-on-One or One-on-Many
  createdBy: Types.ObjectId;
  participants: Types.ObjectId[];
  messages: IMessage[];
  // Group Chat specific fields
  group?: string;
  groupImage?: string;
  roomId?: string;
}

const messageSchema = new Schema<IMessage>(
  {
    content: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const chatSchema = new Schema<IChat>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    messages: [messageSchema],

    group: { type: String },
    groupImage: { type: String },
    roomId: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    strictQuery: true,
  }
);

export const chatModel =
  mongoose.models.Chat || mongoose.model<IChat>("Chat", chatSchema);

export default chatModel;