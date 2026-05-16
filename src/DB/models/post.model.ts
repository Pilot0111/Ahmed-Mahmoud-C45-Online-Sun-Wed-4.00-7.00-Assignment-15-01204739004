import mongoose, { Schema, Types } from "mongoose";
import { IComment } from "./comment.model";
import {
  Allow_Comment_Enum,
  Availability_Enum,
  Reaction_Enum,
} from "../../common/enum/post.enum";
import { generalRoles } from "../../common/utils/general.role";

export interface IPost {
  _id: Types.ObjectId;
  content?: string | undefined;
  attachments?: string[] | undefined;
  createdBy: Types.ObjectId;
  mentions?: Types.ObjectId[] | undefined; // Changed from 'tags' to 'mentions' for consistency
  reactions?: { userId: Types.ObjectId; type: Reaction_Enum }[] | undefined;
  allowComments?: Allow_Comment_Enum | undefined;
  availability?: Availability_Enum | undefined;
  folderId: string;
  isDeleted?: boolean | undefined;
  deletedAt?: Date | undefined;
  comments?: IComment[] | undefined; // Virtual field for TypeScript
}

const postSchema = new Schema<IPost>(
  {
    content: {
      type: String,
      min: 1,
      required: function (this) {
        return !this.attachments?.length;
      },
      trim: true,
    },
    attachments: [{ type: String }],
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    mentions: [{ type: Types.ObjectId, ref: "User" }],
    reactions: [
      {
        userId: { type: Types.ObjectId, ref: "User" },
        type: { type: String, enum: Object.values(Reaction_Enum) },
      },
    ],
    allowComments: {
      type: String,
      enum: Object.values(Allow_Comment_Enum),
      default: Allow_Comment_Enum.allow,
    },
    availability: {
      type: String,
      enum: Object.values(Availability_Enum),
      default: Availability_Enum.public,
    },
    folderId: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    strictQuery: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
    strict: true,
  },
);

postSchema.pre("save", function () {
  console.log("--- Document Middleware (pre-save) ---");
  console.log(
    `[${new Date().toISOString()}] Hook triggered for post ID: ${this._id || "new document"}`,
  );
  console.log(
    `[${new Date().toISOString()}] Data being persisted:`,
    this.toObject(),
  );
});

/**
 * Global Query Middleware
 * Automatically excludes deleted posts from all find/update operations.
 */
postSchema.pre(/^find/, function (this: mongoose.Query<any, any>) {
  this.where({ isDeleted: { $ne: true } });
});

/**
 * Cascade Soft Delete to Comments
 */
postSchema.post("findOneAndUpdate", async function (doc) {
  if (doc?.isDeleted) {
    await mongoose.model("Comment").updateMany(
      { postId: doc._id },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
  }
});

/**
 * Cascade Hard Delete to Comments
 */
postSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    // Find all comments to get their attachment keys before deleting them
    const comments = await mongoose.model("Comment").find({ postId: doc._id });
    const attachmentKeys = comments.flatMap(c => c.attachments || []);

    // Note: You'd typically trigger an S3 cleanup task here for attachmentKeys
    
    await mongoose.model("Comment").deleteMany({ postId: doc._id });
  }
});

/**
 * Virtual Populate for Comments
 */
postSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "postId",
});

export const postModel =
  mongoose.models.Post || mongoose.model<IPost>("Post", postSchema);
export default postModel;
