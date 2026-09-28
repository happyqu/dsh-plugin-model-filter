/**
 * @happyqu/dsh-plugin-model-filter — Host half.
 *
 * The whole feature is a Client-side composer control: this plugin shadows the
 * shipped `conversation.input.model` seat with a copy of the shipped model
 * selector that adds a filter box over the provider-grouped model list. It
 * reads the same shared per-session ModelDirectory the shipped selector and the
 * `/model` popup read, and submits through the same `directory.select()`, so
 * the Host side needs no service, no RPC endpoint, and no configuration.
 *
 * Deliberately empty: keeping the Host half inert means the bundle stays
 * installable in every profile, including headless ones, where the Client half
 * simply never loads.
 */
export function apply() {}
