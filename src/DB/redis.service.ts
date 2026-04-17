import { createClient } from "redis";
import { REDIS_URL } from "../config/config.service";

export const redisClient = createClient({ url: REDIS_URL || 'redis://localhost:6379' });

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("Redis connected successfully! :):):) 😘😘");
  } catch (error) {
    console.log("Redis connection failed!", error);
  }
};

export const generateOtpKey = (email: string) => `otp::confirmEmail::${email}`;
export const max_Otp_tries = (email: string) => `otp::${email}::MaxOtptries`;
export const block_key_otp = (email: string) => `otp::${email}::block`;

export const max_login_tries = (email: string) => `login::${email}::MaxLoginTries`;
export const block_key_login = (email: string) => `login::${email}::block`;

export const generate2SVOtpKey = (email: string) => `otp::2sv::${email}`;
export const generateForgetPasswordOtpKey = (email: string) => `otp::forgetPassword::${email}`;
export const generateRevokeTokenKey = (userId: string, jti?: string) =>
  jti ? `revokeToken::${userId}::${jti}` : `revokeToken::${userId}`;
export const generateProfileKey = (userId: string) => `profile::${userId}`;

export const setValue = async ({ key, value, ttl }: { key: string; value: any; ttl?: number }) => {
  try {
    const data = typeof value === "string" ? value : JSON.stringify(value);
    return ttl ? await redisClient.set(key, data, { EX: ttl }) : await redisClient.set(key, data);
  } catch (error) {
    console.log("Redis set failed!", error);
  }
};

export const updateValue = async ({ key, value, ttl }: { key: string; value: any; ttl?: number }) => {
  try {
    if (!(await redisClient.exists(key))) return 0;
    return await setValue({ key, value, ttl: ttl ?? 0 });
  } catch (error) {
    console.log("Redis set failed!", error);
  }
};

export const get = async ({ key }: { key: string }) => {
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  } catch (error) {
    console.log("Redis get failed!", error);
  }
};

export const multiGet = async (keys: string[]) => {
  try {
    return await redisClient.mGet(keys);
  } catch (error) {
    console.log("Redis mGet failed!", error);
  }
};

export const ttl = async (key: string) => {
  try {
    return await redisClient.ttl(key);
  } catch (error) {
    console.log("Redis ttl failed!", error);
  }
};

export const exists = async (key: string) => {
  try {
    return await redisClient.exists(key);
  } catch (error) {
    console.log("Redis exists failed!", error);
  }
};

export const deleteKey = async (key: string) => {
  try {
    if (!key) return 0;
    return await redisClient.del(key);
  } catch (error) {
    console.log("Redis del failed!", error);
  }
};

export const increment = async (key: string) => {
  try {
    return await redisClient.incr(key);
  } catch (error) {
    console.log("Redis incr failed!", error);
  }
};