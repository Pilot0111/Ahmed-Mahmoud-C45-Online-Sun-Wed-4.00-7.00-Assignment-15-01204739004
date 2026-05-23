import { Response, NextFunction } from "express";
import notificationRepository from "../DB/repositories/notification.repository";
import userRepository from "../DB/repositories/user.repository";
import postModel from "../DB/models/post.model";
import notificationService from "../service/notification.service";
import { SuccessResponse } from "../common/utils/response.success";
import { AppError } from "../common/utils/global-error-handler";
import { Types } from "mongoose";

class NotificationCRUDService {
  private readonly _notificationRepo = notificationRepository;
  private readonly _userRepo = userRepository;

  // ADMIN ONLY: Send a notification and save to DB
  createNotification = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { title, body, sendTo } = req.body; // sendTo is optional (null = all)

      const notification = await this._notificationRepo.create({
        title,
        body,
        sendTo: sendTo ? new Types.ObjectId(sendTo) : null,
        createdBy: req.user._id,
      });

      // Trigger FCM Logic
      let tokens: string[] = [];
      if (sendTo) {
        const user = await this._userRepo.findById(sendTo);
        tokens = user?.fcmTokens || [];
      } else {
        // Global announcement: Get all users with tokens
        const users = await this._userRepo.find({
          filter: { fcmTokens: { $exists: true, $ne: [] } },
        });
        tokens = users.flatMap((u) => u.fcmTokens || []);
      }

      if (tokens.length > 0) {
        await notificationService.sendNotifications({ tokens, title, body });
      }

      SuccessResponse({ res, status: 201, data: notification, message: "Notification sent and saved" });
    } catch (error) {
      next(error);
    }
  };

  // USER: Get my notifications
  getMyNotifications = async (req: any, res: Response, next: NextFunction) => {
    try {
      const notifications = await this._notificationRepo.find({
        filter: {
          $or: [{ sendTo: req.user._id }, { sendTo: null }],
        },
        options: { sort: { createdAt: -1 } },
      });

      SuccessResponse({ res, data: notifications });
    } catch (error) {
      next(error);
    }
  };

  // ADMIN: Get Dashboard Stats
  getDashboardStats = async (req: any, res: Response, next: NextFunction) => {
    try {
      const [totalUsers, totalPosts, totalNotifications] = await Promise.all([
        this._userRepo.paginate({ page: 1, limit: 1 }).then(r => r.meta.Total_Documents),
        postModel.countDocuments({ isDeleted: false }),
        this._notificationRepo.countDocuments({}), // Use the new repository method
      ]);

      SuccessResponse({
        res,
        data: { totalUsers, totalPosts, totalNotifications },
        message: "Dashboard stats retrieved"
      });
    } catch (error) {
      next(error);
    }
  };

  // ADMIN: Delete a notification record
  deleteNotification = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { notificationId } = req.params;
      const deleted = await this._notificationRepo.findOneAndDelete({ filter: { _id: notificationId } });
      if (!deleted) return next(new AppError("Notification not found", 404));

      SuccessResponse({ res, message: "Notification record deleted" });
    } catch (error) {
      next(error);
    }
  };
}

export default new NotificationCRUDService();