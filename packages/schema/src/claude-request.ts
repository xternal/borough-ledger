/* The rules the Claude API enforces on a Messages request for the model this site uses (claude-opus-5-5), checked
   before a request is sent and in tests. Pure: no network. Each rule is one the API answers with a 400, or a parameter
   sent with the wrong beta header. The first was learned the hard way: claude-opus-5-5 refuses a forced tool call
   ("tool_choice: type \"tool\" and \"any\" are not supported for this model."), and the daily decisions job failed on it
   every day from 14 to 16 October 2026 until commit da28939 asked for structured outputs instead. */

export interface ClaudeRequest {
  /** Every header except the API key, which the caller adds. */
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export const API_VERSION = "2023-06-01";
/** `fallbacks: "default"` needs this header; the array form needs the older one. Either header with the other form is a 400. */
export const FALLBACK_DEFAULT_BETA = "server-side-fallback-2026-07-01";
export const FALLBACK_LIST_BETA = "server-side-fallback-2026-06-01";
/** JSON schema keywords structured outputs do not accept. */
const UNSUPPORTED_SCHEMA_KEYWORDS = ["minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"];

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

function schemaProblems(schema: unknown, path: string, out: string[]) {
  if (Array.isArray(schema)) return schema.forEach((s, i) => schemaProblems(s, `${path}[${i}]`, out));
  if (!isObj(schema)) return;
  for (const k of UNSUPPORTED_SCHEMA_KEYWORDS) if (k in schema) out.push(`${path}: structured outputs do not accept "${k}"`);
  if (schema.type === "object" && schema.additionalProperties !== false) out.push(`${path}: every object needs additionalProperties: false`);
  for (const [k, v] of Object.entries(schema)) schemaProblems(v, `${path}.${k}`, out);
}

/** Why the API would refuse this request; an empty list when it would take it. */
export function requestProblems({ headers, body }: ClaudeRequest): string[] {
  const out: string[] = [];
  const betas = (headers["anthropic-beta"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (headers["anthropic-version"] !== API_VERSION) out.push(`anthropic-version header must be ${API_VERSION}`);
  if (typeof body.model !== "string" || !body.model) out.push("no model");
  if (typeof body.max_tokens !== "number" || body.max_tokens < 1) out.push("no max_tokens");

  const choice = body.tool_choice;
  if (isObj(choice) && (choice.type === "tool" || choice.type === "any"))
    out.push(`tool_choice type "${choice.type}": the model refuses a forced tool call; ask for structured outputs (output_config.format) or use tool_choice "auto"`);

  const thinking = body.thinking;
  if (isObj(thinking) && (thinking.type === "disabled" || thinking.type === "enabled" || "budget_tokens" in thinking))
    out.push(`thinking ${JSON.stringify(thinking)}: the model always thinks; leave thinking out (or adaptive) and lower output_config.effort instead`);

  for (const k of ["temperature", "top_p", "top_k"]) if (k in body) out.push(`${k}: the model takes no sampling parameters`);

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) out.push("no messages");
  else if (!isObj(messages.at(-1)) || (messages.at(-1) as Obj).role !== "user") out.push("the last message must be the user's: the model takes no prefilled answer");

  if ("output_format" in body) out.push("output_format is replaced by output_config.format");
  const format = isObj(body.output_config) ? body.output_config.format : undefined;
  if (format !== undefined) {
    if (!isObj(format) || format.type !== "json_schema" || !isObj(format.schema)) out.push('output_config.format must be { type: "json_schema", schema }');
    else schemaProblems(format.schema, "schema", out);
  }

  if (body.fallbacks === "default" && !betas.includes(FALLBACK_DEFAULT_BETA)) out.push(`fallbacks "default" needs the ${FALLBACK_DEFAULT_BETA} beta header`);
  if (Array.isArray(body.fallbacks) && !betas.includes(FALLBACK_LIST_BETA)) out.push(`a list of fallbacks needs the ${FALLBACK_LIST_BETA} beta header`);
  if (body.fallbacks !== undefined && betas.includes(FALLBACK_DEFAULT_BETA) && betas.includes(FALLBACK_LIST_BETA))
    out.push("send one server-side-fallback beta header, not both");

  return out;
}
