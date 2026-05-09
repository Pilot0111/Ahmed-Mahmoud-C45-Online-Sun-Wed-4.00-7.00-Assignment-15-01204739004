import { Router } from "express";
import commentService from "./comment.service";
import { authentication } from "../common/middleware/authentication";
import { Validation } from "../common/middleware/validation";
import { createCommentSchema, commentIdSchema } from "./comment.validation";
import { postIdSchema } from "../post/post.validation";

const commentRouter = Router();

commentRouter.post("/:postId", authentication, Validation(createCommentSchema), commentService.createComment);
commentRouter.get("/:postId", authentication, Validation(postIdSchema), commentService.getPostComments);
commentRouter.delete("/:commentId", authentication, Validation(commentIdSchema), commentService.deleteComment);

export default commentRouter;