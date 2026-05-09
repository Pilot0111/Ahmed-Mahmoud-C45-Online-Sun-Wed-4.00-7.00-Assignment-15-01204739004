import mongoose, { Schema, Types } from "mongoose";
import {
  Allow_Comment_Enum,
  Availability_Enum,
  Reaction_Enum,
} from "../../common/enum/post.enum";
import { generalRoles } from "../../common/utils/general.role";

export interface IPost {
  _id: Types.ObjectId;
  content?: string;
  attachments?: string[];
  createdBy: Types.ObjectId;
  tags?: Types.ObjectId[];
  reactions?: { userId: Types.ObjectId; type: Reaction_Enum }[];
  allowComments?: Allow_Comment_Enum;
  availability?: Availability_Enum;
  folderId: string;
  isDeleted?: boolean;
  deletedAt?: Date;
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
    tags: [{ type: Types.ObjectId, ref: "Tag" }],
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
    await mongoose.model("Comment").deleteMany({ postId: doc._id });
  }
});

export const postModel =
  mongoose.models.Post || mongoose.model<IPost>("Post", postSchema);
export default postModel;
