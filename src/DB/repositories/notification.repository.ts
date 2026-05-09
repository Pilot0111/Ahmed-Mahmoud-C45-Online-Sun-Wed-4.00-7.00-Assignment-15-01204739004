import { Model } from "mongoose";
import BaseRepository from "./base.repository";
import notificationModel, { INotification } from "../models/notification.model";

class NotificationRepository extends BaseRepository<INotification> {
  constructor(model: Model<INotification> = notificationModel) {
    super(model);
  }
}

export default new NotificationRepository();