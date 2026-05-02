import { Router } from "express";
import userService from "./auth.service";
import { Validation } from "../common/middleware/validation";
import { signUpSchema, signInSchema, confirmEmailSchema, updatePasswordSchema, gmailTokenSchema, forgetPasswordSchema, resetPasswordSchema, resendOtpSchema, presignedUrlSchema, getKeySchema, deleteFilesSchema } from "./user.validation";
import { authentication } from "../common/middleware/authentication";
import multerCloud from "../common/middleware/multer.cloud";
import { Store_Enum } from "../common/enum/multer.enum";

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
authRouter.post("/upload-image",multerCloud( {store_type: Store_Enum.disk}).single("image"),userService.uploadImage);
authRouter.post("/upload-images", multerCloud({ store_type: Store_Enum.disk }).array("images", 10), userService.uploadImages);
authRouter.post("/presigned-url", authentication, Validation(presignedUrlSchema), userService.getPresignedUrl);
authRouter.post("/profile-pic-presigned-url", authentication, Validation(presignedUrlSchema), userService.getProfilePicPresignedUrl);
authRouter.get("/get-file/*key", authentication, userService.getFile);
authRouter.get("/get-files", authentication, userService.getFiles);
authRouter.get("/get-presigned-url/*key", authentication, userService.getPresignedUrlByKey);
authRouter.delete("/delete-files", authentication, Validation(deleteFilesSchema), userService.deleteFiles);
authRouter.delete("/delete-folder/*path", authentication, userService.deleteFolder);

export default authRouter; 