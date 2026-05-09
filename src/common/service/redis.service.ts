import { createClient, RedisClientType } from "redis";
import { Types } from "mongoose";
import { REDIS_URL } from "../../config/config.service";
import { EventEnum } from "../../common/enum/emailEvent.enum";

class RedisService {
  private readonly client: RedisClientType;

  constructor() {
    this.client = createClient({ url: REDIS_URL || "redis://localhost:6379" });
    this.handleEvent();
  }

  private handleEvent() {
    this.client.on("error", (err) => {
      console.error("Redis Client Error", err);
    });
  }

  async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
      console.log("Redis connected successfully! 🚀");
    }
  }

  // Key Generators
  generateOtpKey({
    email,
    subject = EventEnum.confirmEmail,
  }: {
    email: string;
    subject?: string | EventEnum;
  }) {
    return `otp::${email}::${subject}`;
  }

  maxOtpTriesKey(email: string) {
    return `otp::${email}::MaxOtptries`;
  }

  blockKeyOtp(email: string) {
    return `otp::${email}::block`;
  }

  maxLoginTriesKey(email: string) {
    return `login::${email}::MaxLoginTries`;
  }

  blockKeyLogin(email: string) {
    return `login::${email}::block`;
  }

  generateRevokeTokenKey(userId: string | Types.ObjectId, jti?: string) {
    return jti ? `revokeToken::${userId}::${jti}` : `revokeToken::${userId}`;
  }

  generateProfileKey(userId: Types.ObjectId) {
    return `profile::${userId}`;
  }

  // Data Operations
  async setValue({
    key,
    value,
    ttl,
  }: {
    key: string;
    value: string | object;
    ttl?: number;
  }) {
    try {
      const data = typeof value === "string" ? value : JSON.stringify(value);
      return ttl
        ? await this.client.set(key, data, { EX: ttl })
        : await this.client.set(key, data);
    } catch (error) {
      console.error("Redis set failed!", error);
    }
  }

  async get({ key }: { key: string }) {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    } catch (error) {
      console.error("Redis get failed!", error);
    }
  }

  async deleteKey(key: string | string[]) {
    try {
      if (!key) return 0;
      return await this.client.del(key);
    } catch (error) {
      console.error("Redis del failed!", error);
    }
  }

  async increment(key: string) {
    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error("Redis incr failed!", error);
    }
  }

  async ttl(key: string) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error("Redis ttl failed!", error);
    }
  }

  key(userId: Types.ObjectId) {
        return `user:FCM:${userId}`;
    }

    async addFCM({ userId, FCMToken }: { userId: Types.ObjectId, FCMToken: string }) {
        return await this.client.sAdd(this.key(userId), FCMToken);
    }

    async removeFCM({ userId, FCMToken }: { userId: Types.ObjectId, FCMToken: string }) {
        return await this.client.sRem(this.key(userId), FCMToken);
    }

    async getFCMs(userId: Types.ObjectId) {
        return await this.client.sMembers(this.key(userId));
    }

    async hasFCMs(userId: Types.ObjectId) {
        return await this.client.sCard(this.key(userId));
    }

    async removeFCMUser(userId: Types.ObjectId) {
        return await this.client.del(this.key(userId));
    }

}

export default new RedisService();
