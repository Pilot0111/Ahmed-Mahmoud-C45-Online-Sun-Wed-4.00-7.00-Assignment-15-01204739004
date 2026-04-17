import { EventEmitter } from "node:events";

export const emailEvents = new EventEmitter();

emailEvents.on("confirmEmail", async (fn) => {
  try {
    await fn();
    console.log("Email task completed successfully");
  } catch (error: any) {
    console.error("Email event error:", error?.message);
  }
});
