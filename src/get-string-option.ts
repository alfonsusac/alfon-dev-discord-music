import type { APIChatInputApplicationCommandInteractionData } from "@discordjs/core"

export function get_string_option<R extends boolean | undefined>(
  data: APIChatInputApplicationCommandInteractionData,
  name: string,
  required: R = false as R
)
  : R extends true ? string : string | undefined {
  const option = data.options?.find((o) => o.name === name)
  if (!option) {
    if (required) throw new Error(`Missing required option: ${ name }`)
    return undefined as any
  }
  return "value" in option ? String(option.value) : undefined as any
}
