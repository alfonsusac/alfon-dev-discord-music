import { REST } from "@discordjs/rest"
import { WebSocketManager, WebSocketShardEvents } from "@discordjs/ws"
import { post_error, post_log } from "./discord-log"
import { ApplicationCommandOptionType, ApplicationCommandType, ChannelType, Client, GatewayDispatchEvents, GatewayIntentBits, InteractionType, PermissionFlagsBits, PresenceUpdateStatus } from "@discordjs/core"
import { get_boolean_option } from "./get-boolean-option"
import { get_string_option } from "./get-string-option"
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus, type DiscordGatewayAdapterCreator, type DiscordGatewayAdapterLibraryMethods } from "@discordjs/voice"
import { replier } from "./reply"
import prism from "prism-media"
import { createReadStream, createWriteStream } from "node:fs"
import { pipeline } from "node:stream/promises"

process.on('uncaughtException', async error => {
  console.error(`Uncaught Exception at`)
  console.error(error)
  await post_error(`Uncaught Exception at ${ error }`, true)
  process.exit(1)
})
// process.on('unhandledRejection', async (reason, promise) => {
//   console.error(`Unhandled Rej243ection: ${ reason }!`)
//   promise.catch(async error => {
//     console.error(`Unhandled Rejection at`)
//     console.error(error)
//     await post_error(`Unhandled Rejection at ${ error }`, true)
//   })
// })
process.on("SIGINT", async () => {
  await post_error("Closing application... (SIGINT)")
  process.exit(0)
})
process.on("SIGTERM", async () => {
  await post_error("Closing application... (SIGTERM)")
  process.exit(0)
})
process.on("exit", async () => {
  console.log("exiting...")
})

// ### Main

// # Checking Configs

await post_log(`-# bun ${ Bun.argv.slice(1).join(' ') }\nStarting application...`)

const token = process.env.BOT_TOKEN
if (!token)
  throw new Error("BOT_TOKEN is required")

// go to https://discord.com/developers/applications to make a token

const guild_id = process.env.GUILD_ID
if (!guild_id) throw new Error("GUILD_ID is required")


// get channel id
const channel_id_file = Bun.file('./db/channel_id.txt')
const read_channel_id = async () => await channel_id_file.exists()
  ? (await channel_id_file.text()).trim()
  : null
const set_channel_id = async (nv: string) => channel_id_file.write(nv)


const toggle_file = Bun.file('./db/toggle.txt')
const read_toggle = async () => Boolean(await toggle_file.exists()
  ? (await toggle_file.text()).trim()
  : null)
const set_toggle = async (nv: boolean) => toggle_file.write(nv ? "1" : "")

// # Preparing Audio Files

// convert music to .ogg



const player = createAudioPlayer()
const music_file = Bun.file('./public/muffled.mp3')
if (await music_file.exists() === false) {
  throw new Error("Music file at (./public/muffled.mp3) doesnt exist!")
}

const music_file_ogg = Bun.file('./public/muffled.ogg')
if (await music_file_ogg.exists() === false) {
  try {
    const transcoder = new prism.FFmpeg({
      args: [
        "-i", "./public/muffled.mp3",
        "-f", "ogg",
        "-c:a", "libopus",
        "-b:a", "128k",
        "-ar", "48000",
        "-ac", "2"
      ],
    })
    await pipeline(
      createReadStream("./public/muffled.mp3"),
      transcoder,
      createWriteStream("./public/muffled.ogg"),
    )
  } catch (error) {
    await post_error(`Error transcoding .mp3 to .ogg!: ${ error }`)
    throw error
  }
}

if (await music_file_ogg.exists() === false) {
  throw new Error("Failed finding ./public/muffled.ogg!")
}

const create_resource = () => {
  return createAudioResource(
    createReadStream('./public/muffled.ogg')
      .pipe(new prism.opus.OggDemuxer())
  )
}


let non_playing_ticks = 0

const play_music = () => {
  console.log("-- Playing Music")
  non_playing_ticks = 0
  const resource = create_resource()
  player.play(resource)
}
player.on('error', (error) => {
  console.error("Error playing the player!")
  console.error(error)
})
player.on(AudioPlayerStatus.Idle, play_music)







// # Setting up Client

const rest = new REST({ version: "10" }).setToken(token)
const gateway = new WebSocketManager({
  token,
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildVoiceStates,
  rest,
  initialPresence: {
    status: PresenceUpdateStatus.Online,
    since: null,
    afk: false,
    activities: [],
  },
})
const client = new Client({ rest, gateway })
let connection: VoiceConnection | null = null
let connecting = false
let interval_busy = false





async function set_voice_channel() {
  console.log("setting voice channel...")
  const toggle = await read_toggle()
  if (!guild_id) throw new Error('no guild id in set_voice_channel')

  // This is the most complicated part of the logic.
  // Might need to refactor this later if necessary.
  if (!!toggle !== !!current_voice_channel_id) {
    console.log("toggle different from activity", toggle, current_voice_channel_id)
    // Toggle mismatch from current state
    if (toggle === true) {
      await connect_to_channel_and_subscribe()
    } else {
      connection?.disconnect()
      connection = null
    }
  } else {
    if (!toggle) {
      if (connection) {
        connection.disconnect()
        connection = null
      }
    } else {
      // The same, check if their id is the same
      const channel_id = await read_channel_id()
      const hasReady = connection && connection.state.status === VoiceConnectionStatus.Ready
      console.log("toggle the same from activity. checking channel sameness")
      console.log(channel_id, current_voice_channel_id)
      if (!hasReady || channel_id !== current_voice_channel_id) {
        if (channel_id !== current_voice_channel_id) {
          console.log("stored channel id  different from  current voice channel id")
        }
        await connect_to_channel_and_subscribe()
      }
    }
  }
  return toggle
}


let client_user_id = ""
let current_voice_channel_id: string | null = null
let interval: NodeJS.Timeout
let ready = false


client.once(GatewayDispatchEvents.Ready, async ({ data, api }) => {
  ready = true
  client_user_id = data.user.id
  await post_log(`Logged in as ${ data.user.username }#${ data.user.discriminator }`)

  // Register slash commands once on startup.
  await api.applicationCommands.bulkOverwriteGuildCommands(data.user.id,
    guild_id,
    [
      {
        name: "set-channel",
        description: "Set/update the voice channel this bot will appear.",
        default_member_permissions: String(PermissionFlagsBits.ManageChannels), //only user with manage channel allowed to run this command
        options: [
          {
            type: ApplicationCommandOptionType.Channel,
            name: "channel",
            description: "The voice channel",
            required: true,
            channel_types: [ ChannelType.GuildVoice ],
          },
        ],
      },
      {
        name: "toggle",
        description: "Toggle automatic joining.",
        default_member_permissions: String(PermissionFlagsBits.ManageChannels),
        options: [
          {
            type: ApplicationCommandOptionType.Boolean,
            name: "value",
            description: "true / false",
            required: true,
          },
        ]
      }
    ])

  // try to join vc as soon as its online
  await set_voice_channel()

  // try to join vc every 10 seconds
  clearInterval(interval)
  interval = setInterval(async () => {
    if (interval_busy) {
      console.warn("previous interval still running, skipping this tick")
      return
    }
    interval_busy = true
    try {
      console.log('---interval')
      const toggle = await set_voice_channel()
      const p = player.state.status
      const c = connection?.state.status
      console.log(`---player.state.status: ${ p } - connection.state.status: ${ c }`)

      const healthy = p === AudioPlayerStatus.Playing ||
        p === AudioPlayerStatus.AutoPaused
      // AutoPaused counts as healthy.
      // default no-subscriber is pause so when connection
      // isn't ready the player goes to autopaused.

      if (toggle && !healthy) {
        non_playing_ticks += 1
        console.warn(`not playing for ${ non_playing_ticks } tick(s): ${ p }`)
        if (non_playing_ticks >= 2) {
          post_error(`player looks stuck, restarting playback`)
          play_music()
        }
      } else {
        non_playing_ticks = 0
      }
    } catch (error) {
      console.error("set interval error")
      console.error(error)
    } finally {
      interval_busy = false
    }
  }, 10_000)

  // play the music

  play_music()
})


function hasPermission(memberPermissions: string | undefined, required: bigint): boolean {
  return (BigInt(memberPermissions ?? 0) & required) === required
}


// handle the set-channel command
client.on(GatewayDispatchEvents.InteractionCreate, async ({ data: interaction, api }) => {
  if (interaction.type !== InteractionType.ApplicationCommand || !interaction.guild_id) return
  if (interaction.data.type !== ApplicationCommandType.ChatInput) return

  const reply = replier(api, interaction,)

  if (interaction.data.name === "toggle") {
    const required = PermissionFlagsBits.ManageChannels
    if (!hasPermission(interaction.member?.permissions, required)) {
      await reply("You don't have permission to use this command.", true)
      console.log(`toggle: ${ interaction.user?.id } No permission to use the command`)
      return
    }

    const toggle = get_boolean_option(interaction.data, "value", true)
    await set_toggle(toggle)

    console.log(`toggle: Invoked with value: ${ toggle }`)
    await reply(`Bot configuration updated: Toggle set to: ${ toggle }`)

    await set_voice_channel()

  } else if (interaction.data.name === "set-channel") {
    const required = PermissionFlagsBits.ManageChannels
    if (!hasPermission(interaction.member?.permissions, required)) {
      await reply("You don't have permission to use this command.", true)
      console.log(`set-channel: ${ interaction.user?.id } No permission to use the command`)
      return
    }

    const channelId = get_string_option(interaction.data, "channel", true)
    console.log(`\n\nset-channel: Invoked with channelId: ${ channelId }`)

    await set_channel_id(channelId)
    await reply(`Bot configuration updated: Voice Channel set to: <#${ channelId }>`)

    await set_voice_channel()

  } else {
    await reply("Unknown command", true)
  }
})




// ## The voice part

client.on(
  GatewayDispatchEvents.VoiceStateUpdate,
  async ({ data }) => {
    // Ignore other users' voice state changes
    if (data.user_id !== client_user_id) return
    current_voice_channel_id = data.channel_id
  },
)

let adapters: DiscordGatewayAdapterLibraryMethods | null = null

function create_djs_adapter(): DiscordGatewayAdapterCreator {
  return (methods) => {
    adapters = methods
    return {
      sendPayload(data) {
        if (!ready) return false
        gateway.send(0, data)
        return true
      },
      destroy() {
        adapters = null
      },
    }
  }
}

export async function connect_to_channel_and_subscribe() {
  if (connecting) {
    console.warn("connect already in progress, skipping")
    return
  }
  connecting = true

  let target: VoiceConnection | null = null

  try {
    const channel_id = await read_channel_id()
    if (!channel_id || !guild_id) return

    target = connection
    if (!target) {
      const new_conn = joinVoiceChannel({
        channelId: channel_id,
        guildId: guild_id,
        adapterCreator: create_djs_adapter(),
        selfDeaf: true,
        selfMute: false,
      })
      target = new_conn
      connection = new_conn

      new_conn.on(VoiceConnectionStatus.Destroyed, () => {
        console.log("connection destroyed")
        if (connection === new_conn) connection = null
      })
      new_conn.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log("connection disconnected")
        try {
          await Promise.race([
            entersState(new_conn, VoiceConnectionStatus.Signalling, 5_000),
            entersState(new_conn, VoiceConnectionStatus.Connecting, 5_000),
          ])
          console.log("connection recovering, keeping it")
        } catch {
          console.log("connection did not recover, destroying")
          if (connection === new_conn) connection = null
          if (new_conn.state.status !== VoiceConnectionStatus.Destroyed) {
            new_conn.destroy()
          }
        }
      })
    } else {
      target.rejoin({
        channelId: channel_id,
        selfDeaf: true,
        selfMute: false,
      })
    }

    await entersState(target, VoiceConnectionStatus.Ready, 15_000)
    target.subscribe(player)
  } catch (error) {
    console.log("error!", error)
    if (target) {
      if (connection === target) connection = null
      if (target.state.status !== VoiceConnectionStatus.Destroyed) {
        target.destroy()
      }
    }
    throw error
  } finally {
    connecting = false
  }
}


client.on(
  GatewayDispatchEvents.VoiceServerUpdate,
  (payload) => {
    console.log("on voice_server_update!")
    adapters?.onVoiceServerUpdate(payload.data)
  },
)
client.on(
  GatewayDispatchEvents.VoiceStateUpdate,
  ({ data: payload }) => {
    console.log("on voice_state_update!")
    if (
      payload.guild_id &&
      payload.session_id &&
      payload.user_id === client_user_id
    ) {
      adapters?.onVoiceStateUpdate(payload)
    }
  },
)
gateway.on(WebSocketShardEvents.Closed, () => {
  if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
    connection.destroy()
  }
  connection = null
  adapters?.destroy()
})

// connect to gateway
gateway.connect()