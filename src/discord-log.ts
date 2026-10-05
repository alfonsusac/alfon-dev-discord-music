
if (!process.env.WEBHOOK_URL) {
  console.error('WEBHOOK_URL env required! Not found in .env')
  process.exit(0)
}

export async function post_discord(msg: string) {
  await fetch(`${ process.env.WEBHOOK_URL }`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: msg,
    }),
  })
}