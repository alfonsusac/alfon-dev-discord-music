if (!process.env.WEBHOOK_URL) {
  console.error('WEBHOOK_URL env required! Not found in .env')
  process.exit(0)
}

const package_json = await import('../package.json')

export async function post_discord(msg: string) {
  const res = await fetch(`${ process.env.WEBHOOK_URL }`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: msg,
    }),
  })
  try {
    console.log(await res.json())
  } catch (error) {
  }
}