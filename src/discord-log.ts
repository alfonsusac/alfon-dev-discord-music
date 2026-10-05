if (!process.env.WEBHOOK_URL) {
  console.error('WEBHOOK_URL env required! Not found in .env')
  process.exit(0)
}

const package_json = await import('../package.json')

export async function post_log(msg: string, no_console?: true) {
  try {
    if (!no_console)
      console.log(msg)
    if (process.env.IS_DEV === undefined) {
      const res = await fetch(`${ process.env.WEBHOOK_URL }`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: msg,
        }),
      })
      console.log(await res.json())
    }
  } catch (error) { }
}


export async function post_error(msg: string, no_console?: true) {
  try {
    if (!no_console)
      console.error(msg)
    if (process.env.IS_DEV === undefined) {
      const res = await fetch(`${ process.env.WEBHOOK_URL }`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `<:cross_l:1552875846241357834> ${ msg }`,
        }),
      })
      console.log(await res.json())
    }
  } catch (error) { }
}