import {resolve} from "path";
import { config } from "dotenv";

const NODE_ENV = process.env.NODE_ENV || "development";
config({ path: resolve(__dirname, `../../.env.${NODE_ENV}`) });
export const PORT : number = Number(process.env.PORT)  || 3000;
export const MONGO_URI : string = process.env.MONGO_URI!;

export const EMAIL = process.env.EMAIL;
export const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;



let envPath = {
  production: resolve("./src/config/.env.production"),
  development: resolve("./src/config/.env.development"),
};



export const MONGODB_URI = process.env.MONGODB_URI!;
export const JWT_ACCESS_SECRET_ADMIN = process.env.JWT_ACCESS_SECRET_ADMIN!;
export const JWT_REFRESH_SECRET_ADMIN = process.env.JWT_REFRESH_SECRET_ADMIN!;
export const JWT_ACCESS_SECRET_USER = process.env.JWT_ACCESS_SECRET_USER!;
export const JWT_REFRESH_SECRET_USER = process.env.JWT_REFRESH_SECRET_USER!;
export const PREFIX_USER = process.env.PREFIX_USER!;
export const PREFIX_ADMIN = process.env.PREFIX_ADMIN!;
export const CLIENT_ID = process.env.CLIENT_ID!;

export const SALT_ROUNDS: number = Number(process.env.SALT_ROUNDS) || 10; // Default to 10 if not set or invalid
export const PUBLIC_KEY = process.env.PUBLIC_KEY;
export const PRIVATE_KEY = process.env.PRIVATE_KEY;

export const REDIS_URL = process.env.REDIS_URL;

export const WHITELIST = process.env.WHITELIST?.split(",") || [];
export const DB_NAME = process.env.DB_NAME || "SarahaApp";

export const MONGODB_URI_ONLINE = process.env.MONGODB_URI_ONLINE; 
