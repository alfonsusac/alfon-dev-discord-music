import { MessageFlags, type API, type APIApplicationCommandInteraction } from "@discordjs/core"

export function replier(
  api: API,
  interaction: APIApplicationCommandInteraction,
) {
  return async (
    message: string,
    ephemeral?: boolean,
  ) => {

    await api.interactions.reply(interaction.id, interaction.token, {
      content: message,
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    })
  }
}