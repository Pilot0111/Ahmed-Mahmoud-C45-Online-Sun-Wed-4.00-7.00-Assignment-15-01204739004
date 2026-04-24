import { EventEmitter } from "node:events";
import { EventEnum } from "../../enum/emailEvent.enum";

export const emailEvents = new EventEmitter();

emailEvents.on(EventEnum.confirmEmail, async (fn) => {
  try {
    await fn();
    console.log("Email task completed successfully");
  } catch (error: any) {
    console.error("Email event error:", error?.message);
  }
});
