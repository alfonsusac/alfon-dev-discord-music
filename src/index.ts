import { REST } from "@discordjs/rest"
import { WebSocketManager, WebSocketShardEvents } from "@discordjs/ws"
import { post_error, post_log } from "./discord-log"
import { ApplicationCommandOptionType, ApplicationCommandType, ApplicationIntegrationType, ChannelType, Client, GatewayDispatchEvents, GatewayIntentBits, GatewayOpcodes, InteractionContextType, InteractionType, MessageFlags, PermissionFlagsBits, PresenceUpdateStatus, type API, type APIChatInputApplicationCommandInteractionData, type APIVoiceState, type GatewayReadyDispatchData, type GatewayVoiceServerUpdateDispatchData, type GatewayVoiceStateUpdateDispatchData, type Snowflake } from "@discordjs/core"
import { get_boolean_option } from "./get-boolean-option"
import { get_string_option } from "./get-string-option"
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel, VoiceConnectionStatus, type DiscordGatewayAdapterCreator, type DiscordGatewayAdapterLibraryMethods, type VoiceConnection } from "@discordjs/voice"
import { replier } from "./reply"

process.on('uncaughtException', async error => {
  console.error(`Uncaught Exception at`)
  console.error(error)
  await post_error(`Uncaught Exception at ${ error }`, true)
  process.exit(1)
})
// process.on('unhandledRejection', async (reason, promise) => {
//   console.error(`Unhandled Rejection: ${ reason }!`)
//   promise.catch(async error => {
//     console.error(`Unhandled Rejection at`)
//     console.error(error)
//     await post_error(`Unhandled Rejection at ${ error }`, true)
//   })
// })
process.on("SIGINT", async () => {
  await post_error("Closing application... (SIGINT)")
  process.exit(1)
})
process.on("SIGTERM", async () => {
  await post_error("Closing application... (SIGTERM)")
  process.exit(1)
})
process.on("exit", async () => {
  console.log("exiting...")
})

// ### Main

await post_log(`-# bun ${ Bun.argv.slice(1).join(' ') }\nStarting application...`)

const token = process.env.BOT_TOKEN
if (!token) throw new Error("BOT_TOKEN is required")
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
  ? await toggle_file.text()
  : null)
const set_toggle = async (nv: boolean) => toggle_file.write(nv ? "1" : "")


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


async function set_voice_channel() {
  const toggle = await read_toggle()
  if (!guild_id) throw new Error('no guild id in set_voice_channel')


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

    if (toggle) {
      // The same, check if their id is the same
      const channel_id = await read_channel_id()
      console.log("toggle the same from activity. checking channel sameness")
      console.log(channel_id, current_voice_channel_id)
      if (channel_id !== current_voice_channel_id) {
        console.log("stored channel id  different from  current voice channel id")
        await connect_to_channel_and_subscribe()
      }
    }
  }





  // if (!!toggle === !!current_voice_channel_id) {
  //   console.log(`toggle ${ toggle } === current_voice_channel_id ${ current_voice_channel_id }`)
  //   return true
  // }
  // if (connection === null && toggle === true) {
  //   connection = await connect_to_channel_and_subscribe()
  //   connection.subscribe(player)
  //   return connection
  // }
  // if (connection && toggle === false) {
  //   connection.disconnect()
  //   connection = null
  // }
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
    console.log('---interval')
    await set_voice_channel()
  }, 10_000)

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
    await set_voice_channel()

    await reply(`Bot configuration updated: Voice Channel set to: <#${ channelId }>`)
  } else {
    await reply("Unknown command", true)
  }
})




// ## The voice part


const player = createAudioPlayer()
const music_file = Bun.file('./public/muffled.mp3')
if (await music_file.exists() === false) {
  throw new Error("Music file at (./public/muffled.mp3) doesnt exist!")
}
const create_resource = () => createAudioResource("./public/muffled.mp3")


client.once(GatewayDispatchEvents.Ready, async ({ data, api }) => {
  client_user_id = data.user.id

  const play_music = () => {
    player.play(create_resource())
  }
  player.on(AudioPlayerStatus.Idle, play_music)
  play_music()

  // await connect_to_channel_and_subscribe()
})

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
  const channel_id = await read_channel_id()
  if (!channel_id || !guild_id) throw new Error("channel id or guild id not defined!")

  if (!connection) {
    connection = joinVoiceChannel({
      channelId: channel_id,
      guildId: guild_id,
      adapterCreator: create_djs_adapter(),
      selfDeaf: true,
      selfMute: false,
    })
  } else {
    connection.rejoin({
      channelId: channel_id,
      selfDeaf: true,
      selfMute: false,
    })
  }

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
    connection.subscribe(player)
  } catch (error) {
    console.log("error!", error)
    connection.destroy()
    throw error
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
gateway.on(WebSocketShardEvents.Closed, (_) => {
  adapters?.destroy()
})

// connect to gateway
gateway.connect()