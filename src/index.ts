import { post_discord } from "./discord-log"

await post_discord("Starting appliation...")


process.env.NODE_ENV === ""




process.on("exit", async () => {
  await post_discord("Closing application...")
})