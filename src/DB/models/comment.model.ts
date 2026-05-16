import mongoose, { Schema, Types, type HydratedDocument } from "mongoose";
import { On_Model_Enum } from "../../common/enum/post.enum";

export interface IComment {
  _id: Types.ObjectId;
  content?: string | undefined;
  // postId: Types.ObjectId;
  createdBy: Types.ObjectId;
  folderId?: string | undefined;
  attachments?: string[] | undefined;
  likes?: Types.ObjectId[] | undefined;
  mentions?: Types.ObjectId[] | undefined; // Changed from 'tags' to 'mentions'
  isDeleted?: boolean | undefined;
  deletedAt?: Date | undefined;
  // parentCommentId?: Types.ObjectId | undefined;
  refId: Types.ObjectId;
  onModel: On_Model_Enum;
  replies?: IComment[] | undefined; // Virtual field for TypeScript
}

const commentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      trim: true,
      minlength: 1,
      required: function (this: HydratedDocument<IComment>) {
        return !this.attachments?.length;
      },
    },
    folderId: { type: String },
    attachments: [{ type: String }],
    // postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }], // Changed from 'tags' to 'mentions'
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    // parentCommentId: { type: Schema.Types.ObjectId, ref: "Comment" },
    refId: {
      type: Schema.Types.ObjectId,
      refPath: "onModel",
      required: true,
    },// Dynamic reference to either Post or Comment
    onModel: {
      type: String,
      required: true,
      enum: Object.values(On_Model_Enum),
    },// Discriminator field to determine the referenced model
  },
  {
    timestamps: true,
    strict: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * Virtual for Replies
 */
commentSchema.virtual("replies", {
  ref: "Comment",
  localField: "_id",
  foreignField: "refId",
  match: { onModel: On_Model_Enum.comment },
});

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
