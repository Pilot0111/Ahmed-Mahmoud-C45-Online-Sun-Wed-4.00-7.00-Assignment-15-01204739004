import { Request, Response, NextFunction } from "express";
import { IUser } from "../DB/models/user.model";
import { HydratedDocument } from "mongoose";
import {
  ISignUpType,
  ISignInType,
  IConfirmEmailType,
  IUpdatePasswordType,
  IGmailTokenType,
  IResendOtpType,
} from "./user.validation";
import userRepositoryInstance from "../DB/repositories/user.repository";
import { symmetricEncryption } from "../common/utils/security/encrypt.security";
import {
  hashPassword,
  comparePassword,
} from "../common/utils/security/hash.security";
import { sendEmail } from "../common/utils/email/send.email";
import { otpTemplate } from "../common/utils/email/otp.template";
import { generateOtp } from "../common/utils/security/code.generator";
import { emailEvents } from "../common/utils/email/email.events";
import redisService from "../common/service/redis.service";
import { AppError } from "../common/utils/global-error-handler";
import tokenService from "../common/utils/security/toke.security";
import {
  CLIENT_ID,
  JWT_ACCESS_SECRET_ADMIN,
  JWT_ACCESS_SECRET_USER,
  JWT_REFRESH_SECRET_ADMIN,
  JWT_REFRESH_SECRET_USER,
  PREFIX_ADMIN,
  PREFIX_USER,
} from "../config/config.service";
import { randomUUID } from "node:crypto";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { EventEnum } from "../common/enum/emailEvent.enum";
import { providerEnum } from "../common/enum/provider.enum";
import { SuccessResponse } from "../common/utils/response.success";
import { RoleEnum } from "../common/enum/user.enum";
import { Token } from "nodemailer/lib/xoauth2";

class AuthService {
  private readonly _userModel = userRepositoryInstance;
  private readonly _redisService = redisService;
  private readonly _tokenService = tokenService;

  constructor() {}

  /**
   * Centralized logic for generating, storing, and sending OTPs.
   * Handles max tries and blocking logic.
   */
  private async sendOtpFlow({
    email,
    userName,
    subject,
    isResend = false,
  }: {
    email: string;
    userName: string;
    subject: EventEnum;
    isResend?: boolean;
  }) {
    const blockKey = this._redisService.blockKeyOtp(email);
    const triesKey = this._redisService.maxOtpTriesKey(email);

    // 1. Check if user is blocked
    const isBlocked = await this._redisService.ttl(blockKey);
    if (isBlocked && isBlocked > 0) {
      throw new AppError(
        `Too many attempts. Please try again after ${isBlocked} seconds`,
        429,
      );
    }

    // 2. Handle Tries Logic
    let currentTries = await this._redisService.get({ key: triesKey });

    if (isResend) {
      if (currentTries === null) throw new AppError("No active OTP session found", 400);
      if (Number(currentTries) <= 1) {
        await this._redisService.setValue({ key: blockKey, value: "blocked", ttl: 3600 }); // Block for 1 hour
        await this._redisService.deleteKey(triesKey);
        throw new AppError("Max attempts reached. You are blocked for 1 hour", 429);
      }
      currentTries = String(Number(currentTries) - 1);
    } else {
      currentTries = "3"; // Default tries for new requests
    }

    // 3. Generate and Store OTP
    const otp = await generateOtp();
    await this._redisService.setValue({
      key: this._redisService.generateOtpKey({ email, subject }),
      value: hashPassword({ plainText: String(otp) }),
      ttl: 600,
    });

    // 4. Update Tries in Redis
    await this._redisService.setValue({
      key: triesKey,
      value: currentTries,
      ttl: 600,
    });

    // 5. Emit Email Event
    emailEvents.emit(subject, async () => {
      const displaySubject =
        subject === EventEnum.confirmEmail ? "Email Confirmation" : "Password Reset";
      await sendEmail({
        to: email,
        subject: `${displaySubject} - Social_Media App`,
        html: otpTemplate({
          userName,
          otp,
          subject: displaySubject,
        }),
      });
    });
  }

  signUp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        userName,
        email,
        password,
        address,
        phone,
        age,
        gender,
        role,
      }: ISignUpType = req.body;

      await this._userModel.checkUser(email);

      const user: HydratedDocument<IUser> = await this._userModel.create({
        userName,
        email,
        password: hashPassword({ plainText: password }),
        address,
        phone: phone ? symmetricEncryption(phone) : null,
        age,
        gender,
        role,
      } as Partial<IUser>);

      await this.sendOtpFlow({
        email,
        userName,
        subject: EventEnum.confirmEmail,
      });

      SuccessResponse({
        res,
        status: 201,
        message: "User signed up successfully. Please check your email for the confirmation code.",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  resendOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, subject = EventEnum.confirmEmail }: IResendOtpType = req.body;

      const user = await this._userModel.findOne({ filter: { email } });
      if (!user) return next(new AppError("User not found", 404));

      if (subject === EventEnum.confirmEmail && user.confirmed) {
        return next(new AppError("Email already confirmed", 400));
      }

      await this.sendOtpFlow({
        email,
        userName: user.userName,
        subject: subject as EventEnum,
        isResend: true,
      });

      SuccessResponse({
        res,
        message: "OTP resent successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  confirmEmail = async (req: Request, res: Response, next: NextFunction) => {
    const { email, code }: IConfirmEmailType = req.body;
    const otpValue = await this._redisService.get({
      key: this._redisService.generateOtpKey({ email }),
    });

    if (!otpValue) return next(new AppError("OTP not found or expired", 404));

    const match = comparePassword({
      PlainText: code,
      cipherText: String(otpValue),
    });
    if (!match) return next(new AppError("OTP is incorrect", 401));

    const user = await this._userModel.findOneAndUpdate({
      filter: {
        email,
        confirmed: { $ne: true },
        provider: providerEnum.system,
      },
      update: { confirmed: true },
    });

    if (!user)
      return next(new AppError("User not found or already confirmed", 404));

    await this._redisService.deleteKey(
      this._redisService.generateOtpKey({ email }),
    );
    await this._redisService.deleteKey(
      this._redisService.maxOtpTriesKey(email),
    );

    SuccessResponse({
      res,
      message: "Email confirmed successfully",
    });
  };

  signIn = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password }: ISignInType = req.body;

    const isBlocked = await this._redisService.ttl(
      this._redisService.blockKeyLogin(email),
    );
    if (isBlocked !== undefined && isBlocked > 0) {
      return next(
        new AppError(
          `Account temporarily banned. Please try again after ${isBlocked} seconds`,
          403,
        ),
      );
    }

    const user = await this._userModel.findOne({ filter: { email } });
    if (!user || !user.confirmed) {
      return next(
        new AppError("Invalid credentials or email not confirmed", 401),
      );
    }

    const match = comparePassword({
      PlainText: password,
      cipherText: user.password,
    });
    if (!match) {
      await this._redisService.increment(
        this._redisService.maxLoginTriesKey(email),
      );
      const failed_tries = await this._redisService.get({
        key: this._redisService.maxLoginTriesKey(email),
      });

      if (failed_tries >= 5) {
        await this._redisService.setValue({
          key: this._redisService.blockKeyLogin(email),
          value: "1",
          ttl: 300,
        }); // 5 min block
        await this._redisService.deleteKey(
          this._redisService.maxLoginTriesKey(email),
        );
        return next(
          new AppError(
            "Account temporarily banned due to 5 consecutive failed login attempts",
            403,
          ),
        );
      }
      return next(new AppError("Invalid credentials", 401));
    }

    await this._redisService.deleteKey(
      this._redisService.maxLoginTriesKey(email),
    );

    const access_token = this._tokenService.generateToken({
      payload: { id: user._id, email: user.email, role: user.role },
      secret_key:
        user.role === RoleEnum.admin
          ? JWT_ACCESS_SECRET_ADMIN
          : JWT_ACCESS_SECRET_USER,
      options: { expiresIn: "1h", jwtid: randomUUID() },
    });

    const refresh_token = this._tokenService.generateToken({
      payload: { id: user._id, email: user.email, role: user.role },
      secret_key:
        user.role === RoleEnum.admin
          ? JWT_REFRESH_SECRET_ADMIN
          : JWT_REFRESH_SECRET_USER,
      options: { expiresIn: "1y", jwtid: randomUUID() },
    });

    SuccessResponse({
      res,
      message: "User signed in successfully",
      data: { token: access_token, refresh_token: refresh_token },
    });
  };

  signUpGmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { idToken }: IGmailTokenType = req.body;
      const client = new OAuth2Client();

      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) return next(new AppError("Invalid Google token", 400));

      const { email, email_verified, name, picture } = payload as TokenPayload;
      if (!email)
        return next(new AppError("Email not found in Google token", 400));

      let user = await this._userModel.findOne({ filter: { email } });

      if (!user) {
        // Create new user if they don't exist
        user = await this._userModel.create({
          userName: name,
          email,
          confirmed: email_verified,
          provider: providerEnum.google,
          profilePicture: picture,
        } as any);
      }

      // If user exists but is registered through system, force password login
      if (user.provider === providerEnum.system) {
        return next(
          new AppError("Please login with your email and password", 400),
        );
      }

      const access_token = this._tokenService.generateToken({
        payload: { id: user._id, email: user.email, role: user.role },
        secret_key:
          user.role === RoleEnum.admin
            ? JWT_ACCESS_SECRET_ADMIN
            : JWT_ACCESS_SECRET_USER,
        options: {
          expiresIn: "1d",
          jwtid: randomUUID(),
          issuer: "Social_Media_App",
        },
      });

      const refresh_token = this._tokenService.generateToken({
        payload: { id: user._id, email: user.email, role: user.role },
        secret_key:
          user.role === RoleEnum.admin
            ? JWT_REFRESH_SECRET_ADMIN
            : JWT_REFRESH_SECRET_USER,
        options: {
          expiresIn: "7d",
          jwtid: randomUUID(),
          issuer: "Social_Media_App",
        },
      });

      SuccessResponse({
        res,
        status: 200,
        message: "Gmail login successful",
        data: { 
          token: access_token, 
          refresh_token,
          prefix: user.role === RoleEnum.admin ? PREFIX_ADMIN : PREFIX_USER 
        },
      });
    } catch (error) {
      next(error);
    }
  };

  forgetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      const user = await this._userModel.findOne({ filter: { email } });
      if (!user) return next(new AppError("User not found", 404));

      await this.sendOtpFlow({
        email,
        userName: user.userName,
        subject: EventEnum.forgetPassword,
      });

      SuccessResponse({
        res,
        message: "Reset code sent to your email",
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    const { email, code, newPassword } = req.body;

    const otpValue = await this._redisService.get({
      key: this._redisService.generateOtpKey({
        email,
        subject: EventEnum.forgetPassword,
      }),
    });
    if (!otpValue)
      return next(new AppError("Reset code expired or not found", 404));

    const match = comparePassword({
      PlainText: code,
      cipherText: String(otpValue),
    });
    if (!match) return next(new AppError("Invalid reset code", 401));

    const user = await this._userModel.findOneAndUpdate({
      filter: { email },
      update: { password: hashPassword({ plainText: newPassword }) },
    });

    if (!user) return next(new AppError("User not found", 404));

    await this._redisService.deleteKey(
      this._redisService.generateOtpKey({
        email,
        subject: EventEnum.forgetPassword,
      }),
    );

    SuccessResponse({
      res,
      message: "Password reset successfully",
    });
  };

  updatePassword = async (req: any, res: Response, next: NextFunction) => {
    const { oldPassword, newPassword }: IUpdatePasswordType = req.body;

    const match = comparePassword({
      PlainText: oldPassword,
      cipherText: req.user.password,
    });
    if (!match) return next(new AppError("Old password is incorrect", 401));

    await this._userModel.findOneAndUpdate({
      filter: { _id: req.user._id },
      update: { password: hashPassword({ plainText: newPassword }) },
    });

    SuccessResponse({
      res,
      message: "Password updated successfully",
    });
  };

  getProfile = async (req: any, res: Response, next: NextFunction) => {
    SuccessResponse({
      res,
      message: "User profile retrieved successfully",
      data: req.user,
    });
  };

  logout = async (req: any, res: Response, next: NextFunction) => {
    const { decoded, user } = req;

    await this._redisService.setValue({
      key: this._redisService.generateRevokeTokenKey(
        user._id.toString(),
        decoded.jti,
      ),
      value: decoded.jti,
      ttl: decoded.exp - Math.floor(Date.now() / 1000),
    });

    SuccessResponse({
      res,
      message: "Logged out successfully",
    });
  };
}

export default new AuthService();
