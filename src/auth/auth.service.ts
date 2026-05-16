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
  IPresignedUrlType,
  IGetKeyType,
  ISendNotificationType,
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
import multerCloud from "../common/middleware/multer.cloud";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Store_Enum } from "../common/enum/multer.enum";
import { ObjectCannedACL } from "@aws-sdk/client-s3";
import { S3Service } from "../service/s3.service";
import notificationService from "../service/notification.service";

class AuthService {
  private readonly _userModel = userRepositoryInstance;
  private readonly _redisService = redisService;
  private readonly _tokenService = tokenService;
  private readonly _s3Service = new S3Service();
  private readonly _notificationService = notificationService;

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
      if (currentTries === null)
        throw new AppError("No active OTP session found", 400);
      if (Number(currentTries) <= 1) {
        await this._redisService.setValue({
          key: blockKey,
          value: "blocked",
          ttl: 3600,
        }); // Block for 1 hour
        await this._redisService.deleteKey(triesKey);
        throw new AppError(
          "Max attempts reached. You are blocked for 1 hour",
          429,
        );
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
        subject === EventEnum.confirmEmail
          ? "Email Confirmation"
          : "Password Reset";
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
        message:
          "User signed up successfully. Please check your email for the confirmation code.",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  resendOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, subject = EventEnum.confirmEmail }: IResendOtpType =
        req.body;

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
    const { email, password, FCM }: ISignInType = req.body;

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

    if (FCM) {
      await redisService.addFCM({
        userId: user._id,
        FCMToken: FCM,
      });
      const tokens = await redisService.getFCMs(user._id);
      await this._notificationService.sendNotifications({
        tokens,
        title: `Welcome back! ${user.userName}`,
        body: `You have successfully signed in. at ${new Date().toLocaleTimeString()}`,
      });
    }

    SuccessResponse({
      res,
      message: "User signed in successfully",
      data: {
        token: access_token,
        refresh_token: refresh_token,
        prefix: user.role === RoleEnum.admin ? PREFIX_ADMIN : PREFIX_USER,
      },
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
          prefix: user.role === RoleEnum.admin ? PREFIX_ADMIN : PREFIX_USER,
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
  uploadImage = async (req: any, res: Response, next: NextFunction) => {
    const FILE_SIZE_THRESHOLD_FOR_LARGE_UPLOAD = 5 * 1024 * 1024; // 5MB

    try {
      if (!req.file) {
        return next(new AppError("No file uploaded", 400));
      }

      let key: string | undefined;
      const s3UploadOptions = {
        file: req.file,
        path: `users/${req.user._id}/uploads`, // A more generic path for all user uploads
        store_type: Store_Enum.disk,
      };

      if (req.file.size > FILE_SIZE_THRESHOLD_FOR_LARGE_UPLOAD) {
        key = await this._s3Service.uploadLargeFile(s3UploadOptions);
      } else {
        key = await this._s3Service.uploadFile(s3UploadOptions);
      }
      if (!key) {
        return next(new AppError("Failed to upload image", 500));
      }

      SuccessResponse({
        res,
        message: "Image uploaded successfully",
        data: { ...req.file, key },
      });
    } catch (error) {
      next(error);
    }
  };

  uploadImages = async (req: any, res: Response, next: NextFunction) => {
    const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB

    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return next(new AppError("No files uploaded", 400));
      }

      // Determine if any file in the batch exceeds the threshold to use multipart upload
      const hasLargeFile = files.some(
        (file) => file.size > FILE_SIZE_THRESHOLD,
      );

      const keys = await this._s3Service.uploadFiles({
        files,
        path: `users/${req.user._id}/multiuploads`,
        store_type: Store_Enum.disk,
        isLargeFile: hasLargeFile,
      });

      SuccessResponse({
        res,
        message: "Images uploaded successfully",
        data: {
          count: keys.length,
          keys,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getPresignedUrl = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { fileName, contentType }: IPresignedUrlType = req.body;

      const result = await this._s3Service.creatPresignedUrl({
        fileName,
        contentType,
        path: `users/${req.user._id}/presigneduploads`,
      });

      SuccessResponse({
        res,
        message: "Presigned URL generated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfilePicPresignedUrl = async (
    req: any,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { fileName, contentType }: IPresignedUrlType = req.body;

      const result = await this._s3Service.creatPresignedUrl({
        fileName,
        contentType,
        path: `users/${req.user._id}/profile`,
      });

      const user = await this._userModel.findByIdAndUpdate({
        id: req.user._id,
        update: { profilePicture: result.Key },
      });

      if (!user) {
        // should  not happen if authentication middleware works correctly
        // and user exists in the database.
        return next(new AppError("User not found", 404));
      }

      SuccessResponse({
        res,
        message: "Profile picture presigned URL generated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getFile = async (req: any, res: Response, next: NextFunction) => {
    try {
      // key is retrieved from req.params because of the /:key(*) route
      let key = req.params.key;
      if (Array.isArray(key)) key = key.join("/");

      // Remove leading slash if present (common when capturing via wildcard)
      if (key) key = key.replace(/^\/+/, "");

      const isDownload = req.query.download === "true";

      if (!key) {
        return next(new AppError("File key is required", 400));
      }

      // Authorization check: Ensure the user can only access files they own or are public
      // We use startsWith (plural) to check the prefix of the S3 Key
      const userPath = `Social_Media_App/users/${req.user._id}/`;
      const publicPath = `Social_Media_App/users/uploads/`;

      if (!key.startsWith(userPath) && !key.startsWith(publicPath)) {
        return next(new AppError("Unauthorized to access this file", 403));
      }

      const result = await this._s3Service.getFile({ key });

      // Set the content type from S3 and pipe the stream to the response
      res.setHeader(
        "Content-Type",
        result.ContentType || "application/octet-stream",
      );
      if (result.ContentLength) {
        res.setHeader("Content-Length", result.ContentLength.toString());
      }
      res.setHeader("cross-origin-resource-policy", "cross-origin");

      // Determine if the file should be downloaded or viewed inline.
      // We use encodeURIComponent and filename* for maximum browser compatibility (RFC 5987).
      const filename = key.split("/").pop();
      const encodedFilename = encodeURIComponent(filename || "file");
      const disposition = isDownload
        ? `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
        : "inline";
      res.setHeader("Content-Disposition", disposition);

      // Ensure the Body is a readable stream before piping it to the response
      if (result.Body instanceof Readable) {
        await pipeline(result.Body, res);
      } else {
        throw new AppError("File body is empty", 404);
      }
    } catch (error) {
      next(error);
    }
  };

  getFiles = async (req: any, res: Response, next: NextFunction) => {
    try {
      // Sanitize the folder input to prevent path traversal
      const folder = ((req.query.folder as string) || "").replace(
        /^\/+|\/+$/g,
        "",
      );
      const userBasePath = `users/${req.user._id}${folder ? `/${folder}` : ""}`;

      const files = await this._s3Service.listFiles({ path: userBasePath });

      SuccessResponse({
        res,
        message: "Files retrieved successfully",
        data: files,
      });
    } catch (error) {
      next(error);
    }
  };

  getPresignedUrlByKey = async (
    req: any,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      let key = req.params.key;
      if (Array.isArray(key)) key = key.join("/");
      if (key) key = key.replace(/^\/+/, "");
      const isDownload = req.query.download === "true";

      if (!key) {
        return next(new AppError("File key is required", 400));
      }

      // Authorization check: Ensure the user can only access files they own or are public
      const userPath = `Social_Media_App/users/${req.user._id}/`;
      const publicPath = `Social_Media_App/users/uploads/`;

      if (!key.startsWith(userPath) && !key.startsWith(publicPath)) {
        return next(new AppError("Unauthorized to access this file", 403));
      }

      const url = await this._s3Service.getPresignedUrlByKey({
        key,
        expiresIn: 3600, // URL valid for 1 hour
        download: isDownload,
      });

      SuccessResponse({
        res,
        message: "Presigned URL generated successfully",
        data: { url },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteFile = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { key } = req.body;

      if (!key) {
        return next(new AppError("File key is required", 400));
      }

      const userPath = `Social_Media_App/users/${req.user._id}/`;
      if (!key.startsWith(userPath)) {
        return next(new AppError("Unauthorized to delete this file", 403));
      }

      await this._s3Service.deleteFile(key);

      SuccessResponse({
        res,
        message: "File deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  deleteFiles = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { keys }: { keys: string[] } = req.body;

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return next(new AppError("File keys are required", 400));
      }

      const userPath = `Social_Media_App/users/${req.user._id}/`;

      // Security: Validate that the user owns every single file requested for deletion
      for (const key of keys) {
        if (!key.startsWith(userPath)) {
          return next(new AppError(`Unauthorized to delete file: ${key}`, 403));
        }
      }

      await this._s3Service.deleteFiles(keys);

      SuccessResponse({
        res,
        message: "Files deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  deleteFolder = async (req: any, res: Response, next: NextFunction) => {
    try {
      let folderPath = req.params.path;
      if (Array.isArray(folderPath)) folderPath = folderPath.join("/");
      if (!folderPath) {
        return next(new AppError("Folder path is required", 400));
      }

      // Sanitize folder path and scope it to the user
      const userBasePath = `users/${req.user._id}/${folderPath.replace(/^\/+|\/+$/g, "")}`;

      // 1. List all files within the folder using the existing listFiles method
      const files = await this._s3Service.listFiles({ path: userBasePath });

      if (files.length === 0) {
        return SuccessResponse({
          res,
          message: "Folder is already empty or does not exist",
        });
      }

      // 2. Extract the full S3 keys for all objects found in the folder
      const keys = files
        .map((file) => file.Key)
        .filter((key): key is string => !!key);

      // 3. Perform a bulk delete using the existing deleteFiles method
      await this._s3Service.deleteFiles(keys);

      SuccessResponse({
        res,
        message: `Successfully deleted folder '${folderPath}' and its ${keys.length} files.`,
      });
    } catch (error) {
      next(error);
    }
  };

  saveFcmToken = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      await this._userModel.findOneAndUpdate({
        filter: { _id: req.user._id },
        update: { $addToSet: { fcmTokens: token } },
      });

      SuccessResponse({
        res,
        message: "FCM Token saved successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  sendNotification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { token, title, body }: ISendNotificationType = req.body;

      const response = await this._notificationService.sendPushNotification({
        token,
        title,
        body,
      });

      SuccessResponse({
        res,
        message: "Notification sent successfully",
        data: { messageId: response },
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new AuthService();
