import { Router } from "express";
import notificationCRUDService from "./notification.service";
import { authentication } from "../../common/middleware/authentication";
import { authorization } from "../../common/middleware/authorization";
import { RoleEnum } from "../../common/enum/user.enum";
import { Validation } from "../../common/middleware/validation";
import { createNotificationSchema, notificationIdSchema } from "./notification.validation";

const notificationRouter = Router();

// Admin-only routes
notificationRouter.post("/", authentication, authorization([RoleEnum.admin]), Validation(createNotificationSchema), notificationCRUDService.createNotification);
notificationRouter.get("/dashboard-stats", authentication, authorization([RoleEnum.admin]), notificationCRUDService.getDashboardStats);
notificationRouter.delete("/:notificationId", authentication, authorization([RoleEnum.admin]), Validation(notificationIdSchema), notificationCRUDService.deleteNotification);

// User-specific routes
notificationRouter.get("/my", authentication, notificationCRUDService.getMyNotifications);
// TODO: Add route for marking notifications as read

export default notificationRouter;