import { Request, Response, NextFunction } from "express";
import postRepositoryInstance from "../../DB/repositories/post.repository";
import { AppError } from "../../common/utils/global-error-handler";
import { randomUUID } from "node:crypto";
import { SuccessResponse } from "../../common/utils/response.success";
import { Store_Enum } from "../../common/enum/multer.enum";
import { S3Service } from "../../common/service/s3.service";
import { ICreatePostType, IUpdatePostType } from "./post.validation";
import userRepository from "../../DB/repositories/user.repository";
import commentRepository from "../../DB/repositories/comment.repository";
import { Types } from "mongoose";
import redisService from "../../common/service/redis.service";
import notificationService from "../../common/service/notification.service"; // Import the default instance
import { availabilityPost } from "../../common/utils/availabilityPost";

class PostService {
  private readonly _postRepository = postRepositoryInstance;
  private readonly _userRepo = userRepository;
  private readonly _commentRepo = commentRepository;
  private readonly _s3Service = new S3Service();
  private readonly _radisService = redisService;
  private readonly _notificationService = notificationService; // Use the imported instance

  createPost = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { content, mentions, allowComments, availability }: ICreatePostType = // Destructure 'mentions' from req.body
        req.body;
      let processedMentions: Types.ObjectId[] = []; // Renamed to avoid conflict with req.body.mentions
      let fcmToken: string[] = [];
      if (mentions?.length) { // Use 'mentions' from req.body
        const mentionedUsers = await this._userRepo.find({
          filter: { _id: { $in: mentions } }, // Filter by 'mentions'
        });
        //check if user mentioned himself in the post
        if (
          mentionedUsers.some(
            (tag) => tag._id.toString() === req.user._id.toString(),
          )
        ) {
          return next(
            new AppError("You cannot mention yourself in a post", 400),
          );
        }
        if (mentionedUsers.length !== mentions.length) { // Compare with 'mentions' length
          return next(new AppError("One or more tags are invalid", 400));
        }

        processedMentions = mentionedUsers.map((user) => user._id); // Map to processedMentions
        const tokensArray = await Promise.all(
          processedMentions.map((id) => this._radisService.getFCMs(id)), // Use processedMentions
        );
        fcmToken = tokensArray.flat();
      }

      let url: string[] = [];
      const folderId = randomUUID();
      if (req.files) {
        url = await this._s3Service.uploadFiles({
          files: req.files as Express.Multer.File[],
          path: `users/${req.user._id}/posts/${folderId}`,
          store_type: Store_Enum.disk,
        });
      }

      const post = await this._postRepository.create({
        content,
        mentions: processedMentions, // Pass 'processedMentions' to the 'mentions' field
        allowComments,
        availability,
        attachments: url,
        folderId,
        createdBy: req?.user?._id!,
      } as any);

      if (!post) {
        await this._s3Service.deleteFiles(url);
        return next(new AppError("Failed to create post", 500));
      }
      if (fcmToken) {
        await this._notificationService.sendNotifications({
          tokens: fcmToken,
          title: "You have been mentioned in a post",
          body: `${req.user.userName} mentioned you in a post.`,
        });
      }
      SuccessResponse({
        res,
        status: 201,
        message: "Post created successfully",
        data: post,
      });
      console.log(fcmToken);
    } catch (error) {
      next(error);
    }
  };

  getPostById = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const post = await this._postRepository.findOne({
        filter: { _id: postId, ...availabilityPost(req) },
        populate: [
          { path: "createdBy", select: "firstName lastName profilePicture" },
          { path: "mentions", select: "userName" },
          { 
            path: "comments",
            populate: { path: "createdBy", select: "firstName lastName profilePicture" }
          } 
        ],
      });

      if (!post) return next(new AppError("Post not found", 404));

      SuccessResponse({
        res,
        message: "Post retrieved successfully",
        data: post,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfilePosts = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const page = +req.query.page || 1;
      const limit = +req.query.limit || 10;

      // Filter: Specific user's posts + visibility check
      const filter = {
        createdBy: userId,
        ...availabilityPost(req),
      };

      const result = await this._postRepository.paginate({
        page,
        limit,
        search: filter,
        populate: [
          { path: "createdBy", select: "firstName lastName profilePicture" },
          { path: "comments" }
        ],
      });

      SuccessResponse({
        res,
        message: "Profile posts retrieved successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPosts = async (req: any, res: Response, next: NextFunction) => {
    try {
      const page = +req.query.page || 1;
      const limit = +req.query.limit || 10;

      // Combined Filter: Visibility rules + Optional content search
      const filter = {
        ...(req.query?.search
          ? { content: { $regex: req.query.search, $options: "i" } }
          : {}),
        ...availabilityPost(req), // Apply visibility rules based on the user's ID
      };

      const result = await this._postRepository.paginate({
        page,
        limit,
        search: filter,
        populate: [
          { path: "createdBy", select: "firstName lastName profilePicture" },
          { path: "comments" }
        ],
      });

      SuccessResponse({
        res,
        message: "Posts retrieved successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
  updatePost = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      //       const updateData: IUpdatePostType = req.body;
      //  const post = await this._postRepository.findOneAndUpdate({
      //         filter: { _id: postId, createdBy: req.user._id },
      //         update: updateData,
      //       });
      const {
        content,
        mentions,
        allowComments,
        availability,
        removeFiles,
        removeMentions, // Renamed for consistency
      }: IUpdatePostType = req.body;

      const post = await this._postRepository.findOne({
        filter: { _id: postId, createdBy: req.user._id },
      });

      if (!post)
        return next(new AppError("Post not found or unauthorized", 404));
      if (removeFiles?.length) {
        const inValidFiles = (removeFiles || []).filter(
          (file) => !post.attachments?.includes(file),
        );
        if (inValidFiles.length > 0) {
          return next(new AppError("One or more files are invalid", 400));
        }
        await this._s3Service.deleteFiles(removeFiles || []);
        if (post.attachments) {
          post.attachments = post.attachments.filter(
            (file) => !(removeFiles || []).includes(file),
          );
        }
      }
      const updateMentions = new Set(post.mentions?.map((mention) => mention.toString())); // Use post.mentions
      removeMentions?.forEach((mention) => updateMentions.delete(mention)); // Remove from updateMentions

      let fcmToken: string[] = [];
      if (mentions?.length) { // `mentions` here refers to the incoming mentions from req.body
        const mentionedUsers = await this._userRepo.find({
          filter: { _id: { $in: mentions } }, // Filter by incoming mentions
        });
        //check if user mentioned himself in the post
        if (
          mentionedUsers.some(
            (tag) => tag._id.toString() === req.user._id.toString(),
          )
        ) {
          return next(
            new AppError("You cannot mention yourself in a post", 400),
          );
        }
        if (mentionedUsers.length !== mentions.length) {
          return next(new AppError("One or more mentions are invalid", 400));
        }
        mentionedUsers.forEach((user) => updateMentions.add(user._id.toString())); // Add to updateMentions
        const tokensArray = await Promise.all(
          mentionedUsers.map((user) => this._radisService.getFCMs(user._id)),
        );
        fcmToken = tokensArray.flat();
      }
      
      // Update mentions after processing additions and removals
      post.mentions = Array.from(updateMentions).map(id => new Types.ObjectId(id));

      // Update primitive fields if provided
      if (content !== undefined) post.content = content;
      if (allowComments !== undefined) post.allowComments = allowComments;
      if (availability !== undefined) post.availability = availability;

      // Handle new file uploads
      if (req.files && req.files.length > 0) {
        const newUrls = await this._s3Service.uploadFiles({
          files: req.files as Express.Multer.File[],
          path: `users/${req.user._id}/posts/${post.folderId}`,
          store_type: Store_Enum.disk,
        });
        post.attachments = [...(post.attachments || []), ...newUrls];
      }

      // Persist changes to Database
      await post.save();

      // Trigger side effects (Notifications)
      if (fcmToken.length > 0) {
        await this._notificationService.sendNotifications({
          tokens: fcmToken,
          title: "You were mentioned in a post update",
          body: `${req.user.userName} mentioned you in an updated post.`,
        });
      }

      SuccessResponse({
        res,
        message: "Post updated successfully",
        data: post,
      });
    } catch (error) {
      next(error);
    }
  };

  deletePost = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { postId: id } = req.params;
      const { type } = req.query; // Check if user wants 'hard' delete

      let post;
      if (type === "hard") {
        // 1. Find post and all its comments to collect S3 keys
        post = await this._postRepository.findOne({ filter: { _id: id, createdBy: req.user._id } });
        if (!post) return next(new AppError("Post not found or unauthorized", 404));

        const comments = await this._commentRepo.find({ filter: { postId: new Types.ObjectId(id) } });
        
        // 2. Collect all attachment keys
        const postKeys = post.attachments || [];
        const commentKeys = comments.flatMap(c => c.attachments || []);
        const allKeys = [...postKeys, ...commentKeys];

        // 3. Physical cleanup of S3 resources
        if (allKeys.length > 0) {
          await this._s3Service.deleteFiles(allKeys);
        }

        // 4. Delete Post (Model hooks handle DB comment deletion)
        post = await this._postRepository.findOneAndDelete({
          filter: { _id: id, createdBy: req.user._id },
        });
      } else {
        // Logical removal (Soft Delete)
        post = await this._postRepository.findOneAndUpdate({
          filter: { _id: id, createdBy: req.user._id, isDeleted: false },
          update: { isDeleted: true, deletedAt: new Date() } as any,
        });
      }

      if (!post) return next(new AppError("Post not found or unauthorized", 404));

      SuccessResponse({ 
        res, 
        message: type === "hard" ? "Post permanently deleted" : "Post moved to trash" 
      });
    } catch (error) {
      next(error);
    }
  };

  reactToPost = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { postId } = req.params;
      const { reaction } = req.body;
      const userId = req.user._id;

      const post = await this._postRepository.findOne({
        filter: { _id: postId, ...availabilityPost(req) },
      });

      if (!post) return next(new AppError("Post not found", 404));

      // Find if user already has a reaction
      const existingReaction = post.reactions?.find(
        (r) => r.userId.toString() === userId.toString()
      );

      let message = "";
      if (existingReaction) {
        if (existingReaction.type === reaction) {
          // Scenario: Toggle off (Same reaction clicked)
          await (post as any).updateOne({ $pull: { reactions: { userId } } });
          message = "Reaction removed";
        } else {
          // Scenario: Update reaction (Different emoji clicked)
          await (post as any).updateOne(
            { "reactions.userId": userId },
            { $set: { "reactions.$.type": reaction } }
          );
          message = `Reaction changed to ${reaction}`;
        }
      } else {
        // Scenario: New reaction
        await (post as any).updateOne({
          $push: { reactions: { userId, type: reaction } },
        });
        message = `Reacted with ${reaction}`;
      }

      SuccessResponse({
        res,
        message,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new PostService();
