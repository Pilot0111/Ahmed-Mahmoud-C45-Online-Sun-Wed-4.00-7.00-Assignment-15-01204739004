import jwt, { Secret, SignOptions, JwtPayload } from "jsonwebtoken";

class TokenService {
  constructor() {}

  generateToken = ({
    payload,
    secret_key,
    options = {},
  }: {
    payload: object;
    secret_key: Secret | undefined;
    options?: SignOptions;
  }): string => {
    if (!secret_key) {
      throw new Error("Token secret key is required");
    }
    return jwt.sign(payload, secret_key, options);
  };

  verifyToken = ({
    token,
    secret_key,
  }: {
    token: string;
    secret_key: Secret | undefined;
  }): JwtPayload => {
    if (!secret_key) {
      throw new Error("Token secret key is required");
    }
    return jwt.verify(token, secret_key) as JwtPayload;
  };
}

export default new TokenService();
