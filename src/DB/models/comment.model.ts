import mongoose, { Schema, Types } from "mongoose";

export interface IComment {
  _id: Types.ObjectId;
  content: string;
  postId: Types.ObjectId;
  createdBy: Types.ObjectId;
  tags?: Types.ObjectId[];
  isDeleted?: boolean;
  deletedAt?: Date;
}

const commentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      min: 1,
    },
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tags: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    strict: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Global Query Middleware
 * Automatically excludes deleted comments from all find/update operations.
 */
commentSchema.pre(/^find/, function (this: mongoose.Query<any, any>) {
  this.where({ isDeleted: { $ne: true } });
});

export const commentModel =
  mongoose.models.Comment || mongoose.model<IComment>("Comment", commentSchema);
export default commentModel;