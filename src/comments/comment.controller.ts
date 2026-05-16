import { Router } from "express";
import commentService from "./comment.service";
import { authentication } from "../common/middleware/authentication";
import { Validation } from "../common/middleware/validation";
import { addCommentSchema, commentIdSchema, updateCommentSchema } from "./comment.validation";

import { postIdSchema } from "../post/post.validation";
import multerCloud from "../common/middleware/multer.cloud";
import { Store_Enum } from "../common/enum/multer.enum";

const commentRouter = Router(({ mergeParams: true }));

commentRouter.post("{/:commentId/replies}", authentication, multerCloud({ store_type: Store_Enum.disk }).array("attachments", 5), Validation(addCommentSchema), commentService.addComment);
commentRouter.get("/", authentication, Validation(postIdSchema), commentService.getPostComments);
commentRouter.patch("/:commentId", authentication, multerCloud({ store_type: Store_Enum.disk }).array("attachments", 5), Validation(updateCommentSchema), commentService.updateComment);
commentRouter.delete("/:commentId", authentication, Validation(commentIdSchema), commentService.deleteComment);

export default commentRouter;