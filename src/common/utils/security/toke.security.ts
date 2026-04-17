import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../../../config/config.service";

export const generateToken = ({ payload = {}, signature = JWT_ACCESS_SECRET, options = {} }: { payload?: any, signature?: string | undefined, options?: jwt.SignOptions } = {}) =>{
    if (!signature) {
        throw new Error("Token signature (secret key) is required");
    }
    return jwt.sign(payload, signature, options);
}

export const verifyToken = ({ token = "", signature = JWT_ACCESS_SECRET, options = {} }: { token?: string, signature?: string | undefined, options?: jwt.VerifyOptions } = {}) =>
  jwt.verify(token, signature as string, options);
