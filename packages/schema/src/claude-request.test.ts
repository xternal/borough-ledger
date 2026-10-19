import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { FALLBACK_DEFAULT_BETA, FALLBACK_LIST_BETA, requestProblems, type ClaudeRequest } from "./claude-request";
import { DATA } from "./data";
import { SYSTEM_PROMPT, linkSchema, openPledges, suggestRequest, userPrompt } from "./decision-links";
import type { Decision } from "./decisions";

const root = join(import.meta.dirname, "..", "..", "..");
const d: Decision = {
  id: "mg-1",
  date: "2026-01-19",
  body: "Cabinet",
  meeting_id: 1,
  item: "6",
  kind: "decision",
  title: "Future Resident Facing Energy Proposals",
  text: "To approve a new H&F service, as part of the H&F ‘Healthy Homes’ programme, to help residents install insulation, solar PV and heat pumps.",
  url: "https://democracy.lbhf.gov.uk/ieDecisionDetails.aspx?AIId=1",
  meeting_url: "https://democracy.lbhf.gov.uk/ieListDocuments.aspx?CId=116&MId=1",
  documents: [],
};
const open = openPledges(DATA.content);
const request = () => suggestRequest("claude-opus-5-5", SYSTEM_PROMPT, userPrompt(d, open), linkSchema(open));
const withBody = (r: ClaudeRequest, body: Record<string, unknown>): ClaudeRequest => ({ headers: r.headers, body: { ...r.body, ...body } });

describe("the daily decisions request to Claude", () => {
  it("is one claude-opus-5-5 takes: structured outputs, no forced tool call, room to think, the default fallback", () => {
    const r = request();
    expect(requestProblems(r)).toEqual([]);
    expect(r.body).not.toHaveProperty("tool_choice");
    expect(r.body).not.toHaveProperty("tools");
    expect(r.body).not.toHaveProperty("thinking");
    expect(r.body.output_config).toEqual({ format: { type: "json_schema", schema: linkSchema(open) } });
    expect(r.body.max_tokens).toBeGreaterThanOrEqual(16000);
    expect(r.body.fallbacks).toBe("default");
    expect(r.headers["anthropic-beta"]).toBe(FALLBACK_DEFAULT_BETA);
    expect(r.headers).not.toHaveProperty("x-api-key"); // added at send time, never kept in a request object
  });

  it("would catch the request that failed every day from 14 to 16 October 2026: a forced tool call", () => {
    // The shape before commit da28939: the answer through a tool the model had to call.
    const broken = withBody(request(), {
      output_config: undefined,
      tools: [{ name: "record_links", description: "Record the pledges this decision moves.", input_schema: { type: "object", properties: {} } }],
      tool_choice: { type: "tool", name: "record_links" },
    });
    expect(requestProblems(broken).join("\n")).toMatch(/tool_choice type "tool": the model refuses a forced tool call/);
    expect(requestProblems(withBody(request(), { tool_choice: { type: "any" } })).join("\n")).toMatch(/tool_choice type "any"/);
    expect(requestProblems(withBody(request(), { tool_choice: { type: "auto" } }))).toEqual([]);
  });

  it("catches the other requests the API refuses", () => {
    const r = request();
    const problem = (body: Record<string, unknown>) => requestProblems(withBody(r, body)).join("\n");
    expect(problem({ thinking: { type: "disabled" } })).toMatch(/always thinks/);
    expect(problem({ thinking: { type: "enabled", budget_tokens: 2000 } })).toMatch(/always thinks/);
    expect(problem({ temperature: 0 })).toMatch(/temperature/);
    expect(problem({ messages: [{ role: "user", content: "q" }, { role: "assistant", content: "{" }] })).toMatch(/prefilled/);
    expect(problem({ output_format: { type: "json_schema" } })).toMatch(/output_config.format/);
    expect(problem({ output_config: { format: { type: "json_schema", schema: { type: "object", properties: { q: { type: "string", minLength: 20 } } } } } })).toMatch(
      /additionalProperties[\s\S]*minLength/,
    );
    expect(problem({ fallbacks: [{ model: "claude-opus-4-8" }] })).toMatch(new RegExp(FALLBACK_LIST_BETA));
    expect(requestProblems({ headers: { ...r.headers, "anthropic-beta": "" }, body: r.body }).join("\n")).toMatch(/fallbacks "default" needs/);
  });

  it("no code in the repository forces a tool call", () => {
    const FORCED = /tool_choice["']?\s*:\s*\{[^}]*\btype["']?\s*:\s*["'](?:tool|any)["']/;
    const dirs = ["packages", "apps/web/app", "apps/web/lib", "apps/web/components", "scripts", "etl"];
    const exts = new Set([".ts", ".tsx", ".js", ".mjs", ".py"]);
    const skip = new Set(["node_modules", ".next", "__pycache__", ".venv"]);
    function* walk(p: string): Generator<string> {
      if (!existsSync(p)) return;
      if (statSync(p).isFile()) return yield p;
      for (const name of readdirSync(p)) if (!skip.has(name)) yield* walk(join(p, name));
    }
    const hits: string[] = [];
    let scanned = 0;
    for (const dir of dirs)
      for (const f of walk(join(root, dir))) {
        if (!exts.has(extname(f)) || f.endsWith(".test.ts")) continue;
        scanned++;
        if (FORCED.test(readFileSync(f, "utf8"))) hits.push(relative(root, f));
      }
    expect(scanned).toBeGreaterThan(50);
    expect(hits).toEqual([]);
  });
});
