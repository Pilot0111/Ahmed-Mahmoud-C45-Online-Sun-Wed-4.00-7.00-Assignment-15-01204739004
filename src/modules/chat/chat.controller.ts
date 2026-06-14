import { Router } from "express";
import chatService from "./chat.service";
import { authentication } from "../../common/middleware/authentication";
import { Store_Enum } from "../../common/enum/multer.enum";
import multerCloud from "../../common/middleware/multer.cloud";
import { Validation } from "../../common/middleware/validation";

const chatRouter = Router({ mergeParams: true });
chatRouter.get("/", authentication ,chatService.getChat);
chatRouter.get("/group/:groupId", authentication, chatService.getGroupChat);

chatRouter.post("/group", authentication, multerCloud({ store_type: Store_Enum.disk }).single("image"), chatService.createGroupChat);

export default chatRouter;
