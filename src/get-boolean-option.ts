import type { APIChatInputApplicationCommandInteractionData } from "@discordjs/core"

export function get_boolean_option<R extends boolean | undefined = undefined>(
  data: APIChatInputApplicationCommandInteractionData,
  name: string,
  required: R = false as R,
): R extends true ? boolean : boolean | undefined {
  const option = data.options?.find(o => o.name === name)

  if (!option) {
    if (required) throw new Error(`Missing required option: ${ name }`)
    return undefined as any
  }

  return "value" in option ? Boolean(option.value) : undefined as any
}
