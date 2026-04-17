import { Request, Response, NextFunction } from "express";
import { IUser } from "../DB/models/user.model";
import { HydratedDocument } from "mongoose";
import {
  ISignUpType,
  ISignInType,
  IConfirmEmailType,
  IUpdatePasswordType,
  IGmailTokenType,
} from "./user.validation";
import userRepository from "../DB/repositories/user.repository";
import { symmetricEncryption } from "../common/utils/security/encrypt.security";
import {
  hashPassword,
  comparePassword, 
} from "../common/utils/security/hash.security";
import { sendEmail } from "../common/utils/email/send.email";
import { otpTemplate } from "../common/utils/email/otp.template";
import { generateOtp } from "../common/utils/security/code.generator";
import { emailEvents } from "../common/utils/email/email.events";
import {
  generateOtpKey,
  setValue,
  get,
  deleteKey,
  max_Otp_tries,
  increment,
  max_login_tries,
  block_key_login,
  ttl,
  generateRevokeTokenKey,
  generateForgetPasswordOtpKey,
} from "../DB/redis/redis.service";
import { AppError } from "../common/utils/global-error-handler";
import { generateToken } from "../common/utils/security/toke.security";
import { JWT_ACCESS_SECRET } from "../config/config.service";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

class AuthService {
  private readonly _userModel = new userRepository();
  constructor() {}
  signUp = async (req: Request, res: Response, next: NextFunction) => {
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
    const otp = await generateOtp();

    await setValue({
      key: generateOtpKey(email),
      value: otp,
      ttl: 600,
    });

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

    emailEvents.emit("confirmEmail", async () => {
      await sendEmail({
        to: email,
        subject: "Email Confirmation - Saraha App",
        html: otpTemplate({
          userName,
          otp,
        }),
      });
    });

    res
      .status(201)
      .json({ message: "User signed up successfully", Data: user });
  };

  confirmEmail = async (req: Request, res: Response, next: NextFunction) => {
    const { email, code }: IConfirmEmailType = req.body;
    const otpValue = await get({ key: generateOtpKey(email) });

    if (!otpValue) return next(new AppError("OTP not found or expired", 404));
    if (code !== String(otpValue)) return next(new AppError("OTP is incorrect", 401));

    const user = await this._userModel.findOneAndUpdate({
      filter: { email, confirmed: { $ne: true } },
      update: { confirmed: true },
    });

    if (!user)
      return next(new AppError("User not found or already confirmed", 404));

    await deleteKey(generateOtpKey(email));
    await deleteKey(max_Otp_tries(email));

    res.status(200).json({ message: "Email confirmed successfully" });
  };

  signIn = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password }: ISignInType = req.body;

    const isBlocked = await ttl(block_key_login(email));
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
      await increment(max_login_tries(email));
      const failed_tries = await get({ key: max_login_tries(email) });

      if (failed_tries >= 5) {
        await setValue({ key: block_key_login(email), value: 1, ttl: 300 }); // 5 min block
        await deleteKey(max_login_tries(email));
        return next(
          new AppError(
            "Account temporarily banned due to 5 consecutive failed login attempts",
            403,
          ),
        );
      }
      return next(new AppError("Invalid credentials", 401));
    }

    await deleteKey(max_login_tries(email));

    const access_token = generateToken({
      payload: { id: user._id, email: user.email, role: user.role },
      options: { expiresIn: "1h", jwtid: randomUUID() },
    });

    res
      .status(200)
      .json({ message: "User signed in successfully", token: access_token });
  };

  signUpGmail = async (req: Request, res: Response, next: NextFunction) => {
    const { idToken }: IGmailTokenType = req.body;
    const client = new OAuth2Client();

    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: "725208979610-gf7bf1v4ic94jj4n32ga591tu3is7ftf.apps.googleusercontent.com",
    });
    
    const payload = ticket.getPayload();
    if (!payload) return next(new AppError("Invalid Google token", 400));

    const { email, email_verified, name, picture } = payload;
    if (!email) return next(new AppError("Email not found in Google token", 400));

    let user = await this._userModel.findOne({ filter: { email } });

    if (!user) {
      // Create new user if they don't exist
      user = await this._userModel.create({
        userName: name,
        email,
        confirmed: email_verified,
        provider: "google", // Adjust to your providerEnum if defined
        profilePicture: picture,
      } as any);
    }

    if (!user) return next(new AppError("User not found", 404));
    // If user exists but is registered through system, force password login
    if ((user as any).provider === "system") {
      return next(new AppError("Please login with your email and password", 400));
    }

    const access_token = generateToken({
      payload: { id: user._id, email: user.email, role: user.role },
      options: { 
        expiresIn: "1d", 
        jwtid: randomUUID(),
        issuer: "Saraha"
      },
    });

    res.status(200).json({ message: "Gmail login successful", token: access_token });
  };

  forgetPassword = async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;
    const user = await this._userModel.findOne({ filter: { email } });
    if (!user) return next(new AppError("User not found", 404));

    const otp = await generateOtp();

    await setValue({
      key: generateForgetPasswordOtpKey(email),
      value: otp,
      ttl: 600,
    });

    emailEvents.emit("confirmEmail", async () => {
      await sendEmail({
        to: email,
        subject: "Reset Password - Saraha App",
        html: otpTemplate({
          userName: user.userName,
          otp,
          subject: "Password Reset",
        }),
      });
    });

    res.status(200).json({ message: "Reset code sent to your email" });
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    const { email, code, newPassword } = req.body;

    const otpValue = await get({ key: generateForgetPasswordOtpKey(email) });
    if (!otpValue) return next(new AppError("Reset code expired or not found", 404));
    if (code !== String(otpValue)) return next(new AppError("Invalid reset code", 401));

    const user = await this._userModel.findOneAndUpdate({
      filter: { email },
      update: { password: hashPassword({ plainText: newPassword }) },
    });

    if (!user) return next(new AppError("User not found", 404));

    await deleteKey(generateForgetPasswordOtpKey(email));

    res.status(200).json({ message: "Password reset successfully" });
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

    res.status(200).json({ message: "Password updated successfully" });
  };

  logout = async (req: any, res: Response, next: NextFunction) => {
    const { decoded, user } = req;

    await setValue({
      key: generateRevokeTokenKey(user._id.toString(), decoded.jti),
      value: decoded.jti,
      ttl: decoded.exp - Math.floor(Date.now() / 1000),
    });

    res.status(200).json({ message: "Logged out successfully" });
  };
}

export default new AuthService();
