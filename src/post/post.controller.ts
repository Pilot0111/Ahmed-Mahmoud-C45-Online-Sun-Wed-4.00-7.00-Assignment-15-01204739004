import { Router } from "express";
import postService from "./post.service";
import { Validation } from "../common/middleware/validation";
import { createPostSchema, updatePostSchema, postIdSchema, reactPostSchema } from "./post.validation";
import { authentication } from "../common/middleware/authentication";
import multerCloud from "../common/middleware/multer.cloud";
import { Store_Enum } from "../common/enum/multer.enum";
import commentRouter from "../comments/comment.controller";

const postRouter: Router = Router();


postRouter.use("/:postId/comments", commentRouter);
postRouter.post(
  "/",
  authentication,
  multerCloud({ store_type: Store_Enum.disk }).array("attachments", 10),
  Validation(createPostSchema),
  postService.createPost
);
postRouter.get("/", authentication, postService.getPosts);
postRouter.get("/profile/:userId", authentication, postService.getProfilePosts);
postRouter.get("/:postId", authentication, Validation(postIdSchema), postService.getPostById);

postRouter.patch("/:postId", authentication, Validation(updatePostSchema), postService.updatePost);
postRouter.delete("/:postId", authentication, Validation(postIdSchema), postService.deletePost);
postRouter.patch("/:postId/react", authentication, Validation(reactPostSchema), postService.reactToPost);

export default postRouter;