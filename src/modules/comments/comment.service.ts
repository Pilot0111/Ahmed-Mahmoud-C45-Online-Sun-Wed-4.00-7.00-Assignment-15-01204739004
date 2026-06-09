import { Request, Response, NextFunction } from "express";
import commentRepository from "../../DB/repositories/comment.repository";
import postRepository from "../../DB/repositories/post.repository";
import userRepository from "../../DB/repositories/user.repository";
import redisService from "../../common/service/redis.service";
import notificationService from "../../common/service/notification.service";
import { AppError } from "../../common/utils/global-error-handler";
import { SuccessResponse } from "../../common/utils/response.success";
import { availabilityPost } from "../../common/utils/availabilityPost";
import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import { S3Service } from "../../common/service/s3.service";
import { Store_Enum } from "../../common/enum/multer.enum";
import { On_Model_Enum } from "../../common/enum/post.enum";
import { IUpdateCommentType } from "./comment.validation";

class CommentService {
  private readonly _commentRepo = commentRepository;
  private readonly _postRepo = postRepository;
  private readonly _userRepo = userRepository;
  private readonly _redisService = redisService;
  private readonly _notificationService = notificationService;
  private readonly _s3Service = new S3Service();

  addComment = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { postId, commentId } = req.params;
      const { content, mentions } = req.body;

      const post = await this._postRepo.findOne({
        filter: { _id: postId, ...availabilityPost(req), allowComments: "allow" }
      });
      if (!post) return next(new AppError("Post not found or comments disabled", 404));

      let refId = postId;
      let onModel: On_Model_Enum = On_Model_Enum.post;

      if (commentId) {
        const parentComment = await this._commentRepo.findOne({
          filter: { _id: commentId }
        });
        if (!parentComment) return next(new AppError("Parent comment not found", 404));
        refId = commentId;
        onModel = On_Model_Enum.comment;
      }

      let processedMentions: Types.ObjectId[] = [];
      let fcmTokens: string[] = [];

      if (mentions?.length) {
        const users = await this._userRepo.find({ filter: { _id: { $in: mentions } } });
        processedMentions = users.map(u => u._id);
        const tokensArray = await Promise.all(processedMentions.map(id => this._redisService.getFCMs(id)));
        fcmTokens = tokensArray.flat();
      }

      let attachments: string[] = [];
      const folderId = randomUUID();
      if (req.files && (req.files as any).length > 0) {
        attachments = await this._s3Service.uploadFiles({
          files: req.files as Express.Multer.File[],
          path: `users/${req.user._id}/posts/${postId}/comments/${folderId}`,
          store_type: Store_Enum.disk,
        });
      }

      const comment = await this._commentRepo.create({
        content,
        refId: new Types.ObjectId(refId),
        onModel,
        createdBy: req.user._id,
        mentions: processedMentions,
        folderId,
        attachments,
      });

      if (!comment) {
        if (attachments.length > 0) await this._s3Service.deleteFiles(attachments);
        return next(new AppError("Failed to add comment", 500));
      }

      if (fcmTokens.length > 0) {
        await this._notificationService.sendNotifications({
          tokens: fcmTokens,
          title: `New mention in ${onModel.toLowerCase()}`,
          body: `${req.user.userName} mentioned you in a ${onModel.toLowerCase()}.`,
        });
      }

      SuccessResponse({ res, status: 201, data: comment, message: `${onModel === On_Model_Enum.post ? "Comment" : "Reply"} created successfully` });
    } catch (error) {
      next(error);
    }
  };

  getPostComments = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const page = +req.query.page || 1;
      const limit = +req.query.limit || 10;

      // Filter for only top-level comments (those without a parent)
      // and then populate their nested replies.
      const result = await this._commentRepo.paginate({
        page,
        limit,
        search: { refId: new Types.ObjectId(postId), onModel: On_Model_Enum.post },
        populate: [
          { path: "createdBy", select: "firstName lastName profilePicture" },
          { path: "replies", populate: { path: "createdBy", select: "firstName lastName profilePicture" } }
        ],
      });

      SuccessResponse({ res, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteComment = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { commentId } = req.params;
      const { type } = req.query;

      const comment = await this._commentRepo.findById(new Types.ObjectId(commentId));
      if (!comment) return next(new AppError("Comment not found", 404));

      // Resolve the postId: if this is a top-level comment, refId IS the postId.
      // If it's a reply, refId points to a parent comment — traverse one level up.
      let postId: Types.ObjectId = comment.refId;
      if (comment.onModel === On_Model_Enum.comment) {
        const parentComment = await this._commentRepo.findById(comment.refId);
        if (!parentComment || parentComment.onModel !== On_Model_Enum.post) {
          return next(new AppError("Could not resolve post ownership", 400));
        }
        postId = parentComment.refId;
      }

      const post = await this._postRepo.findById(postId);

      const isCommentOwner = comment.createdBy.toString() === req.user._id.toString();
      const isPostOwner = post?.createdBy.toString() === req.user._id.toString();

      if (!isCommentOwner && !isPostOwner) {
        return next(new AppError("Unauthorized to delete this comment", 403));
      }

      if (type === "hard") {
        await this._commentRepo.findOneAndDelete({ filter: { _id: commentId } });
        if (comment.attachments && comment.attachments.length > 0) {
          await this._s3Service.deleteFiles(comment.attachments || []);
        }
      } else {
        await this._commentRepo.findOneAndUpdate({
          filter: { _id: commentId },
          update: { isDeleted: true, deletedAt: new Date() } as any
        });
      }

      SuccessResponse({ res, message: "Comment deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  updateComment = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { commentId } = req.params;
      const {
        content,
        mentions,
        removeFiles,
        removeMentions,
      }: IUpdateCommentType = req.body;

      const comment = await this._commentRepo.findOne({
        filter: { _id: commentId, createdBy: req.user._id },
      });

      if (!comment) return next(new AppError("Comment not found or unauthorized", 404));

      // 1. Handle File Removal
      if (removeFiles?.length) {
        const invalidFiles = (removeFiles || []).filter(file => !comment.attachments?.includes(file));
        if (invalidFiles.length > 0) return next(new AppError("One or more files to remove are invalid", 400));
        
        await this._s3Service.deleteFiles(removeFiles || []); // Ensure it's always a string[]
        comment.attachments = comment.attachments?.filter(file => !(removeFiles || []).includes(file));
      }

      // 2. Handle Mentions Update (Add/Remove)
      const updateMentions = new Set(comment.mentions?.map(m => m.toString()));
      removeMentions?.forEach(m => updateMentions.delete(m));

      let fcmTokens: string[] = [];
      if (mentions?.length) {
        const mentionedUsers = await this._userRepo.find({ filter: { _id: { $in: mentions } } });
        
        if (mentionedUsers.some(u => u._id.toString() === req.user._id.toString())) {
          return next(new AppError("You cannot mention yourself", 400));
        }
        if (mentionedUsers.length !== mentions.length) {
          return next(new AppError("One or more mentions are invalid", 400));
        }

        mentionedUsers.forEach(u => updateMentions.add(u._id.toString()));
        const tokensArray = await Promise.all(mentionedUsers.map(u => this._redisService.getFCMs(u._id)));
        fcmTokens = tokensArray.flat();
      }

      comment.mentions = Array.from(updateMentions).map(id => new Types.ObjectId(id));

      // 3. Update Text Content
      if (content !== undefined) comment.content = content;

      // 4. Handle New File Uploads
      // Resolve the postId for the S3 path:
      // If onModel is "post", refId IS the postId. If it's a reply, traverse up.
      let uploadPostId: Types.ObjectId = comment.refId;
      if (comment.onModel === On_Model_Enum.comment) {
        const parentComment = await this._commentRepo.findById(comment.refId);
        if (parentComment?.onModel === On_Model_Enum.post) {
          uploadPostId = parentComment.refId;
        }
      }

      if (req.files && req.files.length > 0) {
        const newUrls = await this._s3Service.uploadFiles({
          files: req.files as Express.Multer.File[],
          path: `users/${req.user._id}/posts/${uploadPostId}/comments/${comment.folderId}`,
          store_type: Store_Enum.disk,
        });
        comment.attachments = [...(comment.attachments || []), ...newUrls];
      }

      // 5. Persist and Notify
      await comment.save();

      if (fcmTokens.length > 0) {
        await this._notificationService.sendNotifications({
          tokens: fcmTokens,
          title: "Mentioned in updated comment",
          body: `${req.user.userName} mentioned you in an updated comment.`,
        });
      }

      SuccessResponse({
        res,
        message: "Comment updated successfully",
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new CommentService();