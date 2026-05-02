import * as z from "zod";
import { GenderEnum, RoleEnum } from "../common/enum/user.enum";
import { EventEnum } from "../common/enum/emailEvent.enum";
import e from "express";

export const signUpSchema = {
  body: z
    .object({ 
      userName: z
        .string("Username must be a string")
        .min(3, "Username must be at least 3 characters long")
        .max(25, "Username must be at most 25 characters long"),
      email: z.string().email("Invalid email address").max(100),
      password: z
        .string("Password must be a string")
        .min(6, "Password must be at least 6 characters long")
        .max(100),
      cPassword: z.string("Confirm Password must be a string"),
      address: z.string().max(200).optional(),
      phone: z.string().max(20).optional(),
      age: z.number().min(18).max(60),
      gender: z.nativeEnum(GenderEnum).optional(),
      role: z.nativeEnum(RoleEnum).optional(),
    })
    .refine((data) => data.password === data.cPassword, {
      message: "Passwords do not match",
      path: ["cPassword"],
      when(payload) {
        return z
          .object({
            password: z
              .string()
              .min(6, "Password must be at least 6 characters long"),
            cPassword: z
              .string()
              .min(6, "Confirm Password must be at least 6 characters long"),
          })
          .safeParse(payload).success;
      },
    }),
};

export const signInSchema = {
  body: z.object({
    email: z.string().email("Invalid email address").max(100),
    password: z
      .string("Password must be a string")
      .min(6, "Password must be at least 6 characters long")
      .max(100),
  }),
};

export const confirmEmailSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    code: z.string().length(6, "OTP must be 6 digits"),
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
    email: z.string().email(),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    email: z.string().email(),
    code: z.string().length(6),
    newPassword: z.string().min(6),
  }),
};

export const resendOtpSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
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
    fileName: z.string().min(1, "File name is required"),
    contentType: z.string().min(1, "Content type is required"),
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

export type ISignUpType = z.infer<typeof signUpSchema.body>;
export type ISignInType = z.infer<typeof signInSchema.body>;
export type IConfirmEmailType = z.infer<typeof confirmEmailSchema.body>;
export type IUpdatePasswordType = z.infer<typeof updatePasswordSchema.body>;
export type IGmailTokenType = z.infer<typeof gmailTokenSchema.body>;
export type IResendOtpType = z.infer<typeof resendOtpSchema.body>;
export type IPresignedUrlType = z.infer<typeof presignedUrlSchema.body>;
export type IGetKeyType = z.infer<typeof getKeySchema.body>;
