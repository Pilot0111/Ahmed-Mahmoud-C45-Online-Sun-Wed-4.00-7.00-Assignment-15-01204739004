import { Router } from "express";
import storyService from "./story.service";
import { authentication } from "../../common/middleware/authentication";
import { Validation } from "../../common/middleware/validation";
import { createStorySchema } from "./story.validation";
import multerCloud from "../../common/middleware/multer.cloud";
import { Store_Enum } from "../../common/enum/multer.enum";

const storyRouter = Router();

storyRouter.post(
  "/",
  authentication,
  multerCloud({ store_type: Store_Enum.disk }).single("image"), // Single image for story
  Validation(createStorySchema),
  storyService.createStory
);
storyRouter.get("/", authentication, storyService.getStories);

export default storyRouter;