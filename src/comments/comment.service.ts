import { Request, Response, NextFunction } from "express";
import commentRepository from "../DB/repositories/comment.repository";
import postRepository from "../DB/repositories/post.repository";
import userRepository from "../DB/repositories/user.repository";
import redisService from "../common/service/redis.service";
import notificationService from "../service/notification.service";
import { AppError } from "../common/utils/global-error-handler";
import { SuccessResponse } from "../common/utils/response.success";
import { availabilityPost } from "../common/utils/availabilityPost";
import { Types } from "mongoose";

class CommentService {
  private readonly _commentRepo = commentRepository;
  private readonly _postRepo = postRepository;
  private readonly _userRepo = userRepository;
  private readonly _redisService = redisService;
  private readonly _notificationService = notificationService;

  createComment = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const { content, tags } = req.body;

      const post = await this._postRepo.findOne({
        filter: { _id: postId, ...availabilityPost(req), allowComments: "allow" }
      });
      if (!post) return next(new AppError("Post not found or comments disabled", 404));

      let mentions: Types.ObjectId[] = [];
      let fcmTokens: string[] = [];

      if (tags?.length) {
        const users = await this._userRepo.find({ filter: { _id: { $in: tags } } });
        mentions = users.map(u => u._id);
        const tokensArray = await Promise.all(mentions.map(id => this._redisService.getFCMs(id)));
        fcmTokens = tokensArray.flat();
      }

      const comment = await this._commentRepo.create({
        content,
        postId: new Types.ObjectId(postId),
        createdBy: req.user._id,
        tags: mentions,
      });

      if (fcmTokens.length > 0) {
        await this._notificationService.sendNotifications({
          tokens: fcmTokens,
          title: "New mention in comment",
          body: `${req.user.userName} mentioned you in a comment.`,
        });
      }

      SuccessResponse({ res, status: 201, data: comment, message: "Comment created" });
    } catch (error) {
      next(error);
    }
  };

  getPostComments = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const page = +req.query.page || 1;
      const limit = +req.query.limit || 10;

      const result = await this._commentRepo.paginate({
        page,
        limit,
        search: { postId: new Types.ObjectId(postId) },
        populate: [{ path: "createdBy", select: "firstName lastName profilePicture" }],
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

      const post = await this._postRepo.findById(comment.postId);
      
      const isCommentOwner = comment.createdBy.toString() === req.user._id.toString();
      const isPostOwner = post?.createdBy.toString() === req.user._id.toString();

      if (!isCommentOwner && !isPostOwner) {
        return next(new AppError("Unauthorized to delete this comment", 403));
      }

      if (type === "hard") {
        await this._commentRepo.findOneAndDelete({ filter: { _id: commentId } });
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
}

export default new CommentService();