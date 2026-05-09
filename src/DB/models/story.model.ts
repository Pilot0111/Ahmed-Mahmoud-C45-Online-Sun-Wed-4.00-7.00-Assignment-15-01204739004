import mongoose, { Schema, Types } from "mongoose";

export interface IStory {
  content?: string;
  image: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const storySchema = new Schema<IStory>(
  {
    content: { type: String, trim: true },
    image: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24 hours in seconds
    },
  },
  { timestamps: true }
);

export const storyModel =
  mongoose.models.Story || mongoose.model<IStory>("Story", storySchema);
export default storyModel;