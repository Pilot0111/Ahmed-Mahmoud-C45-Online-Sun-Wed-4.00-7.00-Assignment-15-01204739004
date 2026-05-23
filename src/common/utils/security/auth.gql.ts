import { AppError } from "../../utils/global-error-handler";
import tokenService from "./toke.security";
import redisService from "../../service/redis.service";
import userRepositoryInstance from "../../../DB/repositories/user.repository";
import {
  JWT_ACCESS_SECRET_ADMIN,
  JWT_ACCESS_SECRET_USER,
} from "../../../config/config.service";
import { RoleEnum } from "../../enum/user.enum";
import { GraphQLError } from "graphql";

export class AuthGraphQL {
  static async authenticate(authorization: string | undefined) {
    if (!authorization) {
      throw new GraphQLError("Authorization header is required", {
        extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
      });
    }

    const [prefix, token] = authorization.split(" ");
    if (!token) {
      throw new GraphQLError("Invalid token format", {
        extensions: { code: "BAD_USER_INPUT", http: { status: 401 } },
      });
    }

    // 1. Determine secret based on prefix (logic from your middleware)
    const secret = prefix === "Admin" ? JWT_ACCESS_SECRET_ADMIN : JWT_ACCESS_SECRET_USER;

    // 2. Verify Token
    const decoded = tokenService.verifyToken({ token, secret_key: secret });
    if (!decoded || !decoded.id) {
      throw new GraphQLError("Invalid or expired token", {
        extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
      });
    }

    // 3. Check Redis for revoked tokens
    const isRevoked = await redisService.get({
      key: redisService.generateRevokeTokenKey(decoded.id, decoded.jti),
    });
    if (isRevoked) {
      throw new GraphQLError("Token has been revoked. Please login again.", {
        extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
      });
    }

    // 4. Find User
    const user = await userRepositoryInstance.findById(decoded.id);
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND", http: { status: 404 } },
      });
    }

    if (user.isDeleted) { 
      throw new GraphQLError("Account is deleted", {
        extensions: { code: "FORBIDDEN", http: { status: 403 } },
      });
    }

    return { user, decoded };
  }

  static authorize(role: RoleEnum | undefined, allowedRoles: RoleEnum[]) {
    if (!role || !allowedRoles.includes(role)) {
      throw new GraphQLError("Forbidden: You do not have the required permissions", {
        extensions: { code: "FORBIDDEN", http: { status: 403 } },
      });
    }
  }
}