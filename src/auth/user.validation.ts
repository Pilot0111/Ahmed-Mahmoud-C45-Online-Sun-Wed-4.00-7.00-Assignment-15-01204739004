import * as z from "zod";
import { GenderEnum, RoleEnum } from "../common/enum/user.enum";
import { EventEnum } from "../common/enum/emailEvent.enum";

export const signUpSchema = {
  body: z
    .object({ 
      userName: z.string({ message: "Username must be a string." })
        .min(3, "Username must be at least 3 characters long")
        .max(25, "Username must be at most 25 characters long")
        .nonempty("Username is required."), // Use nonempty for required string
      email: z.string({ message: "Email must be a string." }).email("Invalid email address.").max(100).nonempty("Email is required."),
      password: z.string({ message: "Password must be a string." })
        .min(6, "Password must be at least 6 characters long")
        .max(100)
        .nonempty("Password is required."),
      cPassword: z.string().nonempty("Confirm Password is required."),
      address: z.string().max(200).optional(),
      phone: z.string().max(20).optional(),
      age: z.number().min(18).max(60),
      gender: z.nativeEnum(GenderEnum).optional(),
      role: z.nativeEnum(RoleEnum).optional(),
    })
    .refine((data) => data.password === data.cPassword, {
      message: "Passwords do not match",
      path: ["cPassword"],
    }),
};

export const signInSchema = {
  body: z.object({
    email: z.string({ message: "Email must be a string." }).email("Invalid email address.").max(100).nonempty("Email is required."),
    password: z.string({ message: "Password must be a string." })
      .min(6, "Password must be at least 6 characters long")
      .max(100).nonempty("Password is required."),
    FCM: z.string().optional(), // Add FCM token here
  }),
};

export const confirmEmailSchema = {
  body: z.object({
    email: z.string().email("Invalid email address.").nonempty("Email is required."),
    code: z.string().length(6, "OTP must be 6 digits.").nonempty("OTP code is required."),
  }),
};

export const updatePasswordSchema = {
  body: z
    .object({
      oldPassword: z.string().min(6),
      newPassword: z.string().min(6),
      cPassword: z.string().min(6),
    })
    .refine((data) => data.newPassword === data.cPassword, {
      message: "Passwords do not match",
      path: ["cPassword"],
    }),
};

export const forgetPasswordSchema = {
  body: z.object({
    email: z.string({ message: "Email must be a string." }).email("Invalid email address.").nonempty("Email is required."),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    email: z.string({ message: "Email must be a string." }).email("Invalid email address.").nonempty("Email is required."),
    code: z.string({ message: "OTP code must be a string." }).length(6, "OTP must be 6 digits.").nonempty("OTP code is required."),
    newPassword: z.string({ message: "New password must be a string." }).min(6, "New password must be at least 6 characters long.").nonempty("New password is required."),
  }),
};

export const resendOtpSchema = {
  body: z.object({ // Removed required_error from z.string()
    email: z.string({ message: "Email must be a string." }).email("Invalid email address.").nonempty("Email is required."),
    subject: z.nativeEnum(EventEnum).optional(),
  }),
};

export const gmailTokenSchema = {
  body: z.object({
    idToken: z.string().min(1, "Google ID Token is required"),
  }),
};

export const presignedUrlSchema = {
  body: z.object({
    fileName: z.string({ message: "File name must be a string." }).min(1, "File name cannot be empty.").nonempty("File name is required."),
    contentType: z.string({ message: "Content type must be a string." }).min(1, "Content type cannot be empty.").nonempty("Content type is required."),
  }),
};

export const getKeySchema = {
  body: z.object({
    key: z.string().min(1, "File key is required"),
  }),
};

export const deleteFilesSchema = {
  body: z.object({
    keys: z.array(z.string().min(1)).min(1, "At least one key is required"),
  }),
};

export const sendNotificationSchema = {
  body: z.object({
    token: z.string({ message: "FCM Token must be a string." }).min(1, "FCM Token cannot be empty.").nonempty("FCM Token is required."),
    title: z.string({ message: "Notification title must be a string." }).min(1, "Notification title cannot be empty.").nonempty("Notification title is required."),
    body: z.string({ message: "Notification body must be a string." }).min(1, "Notification body cannot be empty.").nonempty("Notification body is required."),
  }),
};

export const saveFcmTokenSchema = {
  body: z.object({
    token: z.string({ message: "FCM Token must be a string." }).min(1, "FCM Token cannot be empty.").nonempty("FCM Token is required."),
  }),
};

export type ISignUpType = z.infer<typeof signUpSchema.body>;
export type ISignInType = z.infer<typeof signInSchema.body>;
export type IConfirmEmailType = z.infer<typeof confirmEmailSchema.body>;
export type IUpdatePasswordType = z.infer<typeof updatePasswordSchema.body>;
export type IGmailTokenType = z.infer<typeof gmailTokenSchema.body>;
export type IResendOtpType = z.infer<typeof resendOtpSchema.body>;
export type IPresignedUrlType = z.infer<typeof presignedUrlSchema.body>;
export type IGetKeyType = z.infer<typeof getKeySchema.body>;
export type ISendNotificationType = z.infer<typeof sendNotificationSchema.body>;
