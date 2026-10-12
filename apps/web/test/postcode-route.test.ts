import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/postcode/route";

const req = (body: unknown) => new Request("http://localhost/api/postcode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("the postcode lookup on our own server", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks postcodes.io for the council and ward and passes back nothing else, keeping and logging nothing", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 200,
          result: [{ query: "W6 9JU", result: { postcode: "W6 9JU", admin_district: "Hammersmith and Fulham", longitude: -0.22, codes: { admin_ward: "E05013741", admin_district: "E09000013", lsoa: "E01001" } } }],
        }),
      ),
    );
    const log = vi.spyOn(console, "log");
    const err = vi.spyOn(console, "error");
    const res = await POST(req({ postcodes: ["w69ju"] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ result: [{ result: { postcode: "W6 9JU", admin_district: "Hammersmith and Fulham", codes: { admin_ward: "E05013741", admin_district: "E09000013" } } }] });
    const [url, init] = upstream.mock.calls[0]!;
    expect(String(url)).not.toContain("9JU"); // in the body, never the address
    expect(String(init?.body)).toContain("W6 9JU");
    expect(init?.cache).toBe("no-store");
    expect(log).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });

  it("refuses anything but one full postcode, and says when postcodes.io does not answer", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    expect((await POST(req({ postcodes: ["W6"] }))).status).toBe(400);
    expect((await POST(req({ postcodes: ["W6 9JU", "W6 0AA"] }))).status).toBe(400);
    expect((await POST(req({ nothing: true }))).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
    expect((await POST(req({ postcodes: ["W6 9JU"] }))).status).toBe(502);
  });
});
