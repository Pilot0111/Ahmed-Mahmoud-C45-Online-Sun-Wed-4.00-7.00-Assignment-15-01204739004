import { Request, Response, NextFunction } from "express";
import storyRepository from "../DB/repositories/story.repository";
import { AppError } from "../common/utils/global-error-handler";
import { SuccessResponse } from "../common/utils/response.success";
import { ICreateStoryType } from "./story.validation";
import { S3Service } from "../service/s3.service";
import { Store_Enum } from "../common/enum/multer.enum";
import { randomUUID } from "node:crypto";

class StoryService {
  private readonly _storyRepo = storyRepository;
  private readonly _s3Service = new S3Service();

  createStory = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { content }: ICreateStoryType = req.body;
      let imageUrl: string | undefined;

      if (req.file) {
        const folderId = randomUUID(); // Unique folder for story images
        const uploadedUrls = await this._s3Service.uploadFiles({
          files: [req.file as Express.Multer.File],
          path: `Users/${req.user._id}/Stories/${folderId}`,
          store_type: Store_Enum.disk,
        });
        imageUrl = uploadedUrls[0];
      }

      if (!content && !imageUrl) {
        return next(new AppError("Story must have content or an image", 400));
      }

      const story = await this._storyRepo.create({
        content,
        image: imageUrl,
        createdBy: req.user._id,
      } as any);

      SuccessResponse({ res, status: 201, data: story, message: "Story created successfully" });
    } catch (error) {
      next(error);
    }
  };

  // Get stories from friends and self
  getStories = async (req: any, res: Response, next: NextFunction) => {
    try {
      const friendsAndSelf = [...(req.user?.friends || []), req.user._id];

      const stories = await this._storyRepo.find({
        filter: { createdBy: { $in: friendsAndSelf } },
        options: { 
          sort: { createdAt: -1 },
          populate: [{ path: "createdBy", select: "userName profilePicture" }] 
        },
      });

      SuccessResponse({ res, data: stories, message: "Stories retrieved successfully" });
    } catch (error) {
      next(error);
    }
  };

  // No explicit deleteStory needed due to TTL index
}

export default new StoryService();