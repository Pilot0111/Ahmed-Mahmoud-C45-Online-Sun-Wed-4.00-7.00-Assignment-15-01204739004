import admin from "firebase-admin";
import path from "node:path";
import { readFileSync } from "node:fs";
import { AppError } from "../common/utils/global-error-handler";

export class NotificationService {
  private readonly client: admin.app.App;
  constructor() {
    const serviceAccount = JSON.parse(
      readFileSync(
        path.resolve(process.cwd(), "src/config/firebase-service-account.json"),
        "utf-8",
      ),
    );

    this.client = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  async sendPushNotification({
    token,
    title,
    body,
  }: {
    token: string;
    title: string;
    body: string;
  }): Promise<string> {
    try {
      const response = await this.client.messaging().send({
        notification: { title, body },
        token,
        webpush: {
          notification: {
            title,
            body,
            requireInteraction: true, // Prevents the notification from disappearing automatically
          },
        },
      });
      console.log("Successfully sent message to FCM:", response);
      return response;
    } catch (error: any) {
      console.error("FCM Error sending notification:", error);
      throw new AppError(error.message || "Failed to send notification", 500);
    }
  }
  async sendNotifications({
    tokens,
    title,
    body,
  }: {
    tokens: string[];
    title: string;
    body: string;
  }): Promise<string[]> {
    try {
      const results = await Promise.all(
        tokens.map((token) => this.sendPushNotification({ token, title, body }))
      );
      return results;
    } catch (error: any) {
      console.error("FCM Error sending multicast notification:", error);
      throw new AppError(error.message || "Failed to send notification", 500);
    }
  }
}

export default new NotificationService();
