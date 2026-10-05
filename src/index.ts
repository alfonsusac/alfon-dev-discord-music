import { post_discord } from "./discord-log"

await post_discord(`-# bun ${Bun.argv.slice(1).join(' ')}\nStarting application...`)



process.on("exit", async () => {
  await post_discord("Closing application...")
})