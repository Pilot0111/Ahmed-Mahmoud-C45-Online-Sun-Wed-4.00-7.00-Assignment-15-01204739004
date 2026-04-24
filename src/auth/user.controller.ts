import { Router } from "express";
import userService from "./auth.service";
import { Validation } from "../common/middleware/validation";
import { signUpSchema, signInSchema, confirmEmailSchema, updatePasswordSchema, gmailTokenSchema, forgetPasswordSchema, resetPasswordSchema, resendOtpSchema } from "./user.validation";
import { authentication } from "../common/middleware/authentication";

const authRouter: Router = Router();

authRouter.post("/signup", Validation(signUpSchema) ,userService.signUp);
authRouter.patch("/confirm-email", Validation(confirmEmailSchema), userService.confirmEmail);
authRouter.patch("/resend-otp", Validation(resendOtpSchema), userService.resendOtp);
authRouter.post("/signin", Validation(signInSchema), userService.signIn);
authRouter.post("/gmail-login", Validation(gmailTokenSchema), userService.signUpGmail);
authRouter.get("/profile", authentication, userService.getProfile);
authRouter.patch("/forget-password", Validation(forgetPasswordSchema), userService.forgetPassword);
authRouter.patch("/reset-password", Validation(resetPasswordSchema), userService.resetPassword);
authRouter.patch("/update-password", authentication, Validation(updatePasswordSchema), userService.updatePassword);
authRouter.post("/logout", authentication, userService.logout);

export default authRouter;