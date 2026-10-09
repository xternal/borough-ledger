import { describe, expect, it } from "vitest";
import kc from "../../../data/build/boroughs/kensington-and-chelsea/people.json";
import kcStatement from "../../../data/build/boroughs/kensington-and-chelsea/statement.json";
import { BoroughPeople, BoroughStatement, checkBoroughPeople } from "./boroughs";

const people = () => BoroughPeople.parse(structuredClone(kc));

describe("other boroughs", () => {
  it("parses Kensington and Chelsea and finds nothing wrong", () => {
    expect(BoroughStatement.parse(kcStatement).bill.band_d_gla).toBe(510.51);
    expect(checkBoroughPeople(people())).toEqual([]);
  });

  it("works out control from seats, never from a name", () => {
    const p = people();
    p.control = p.parties[1]!.id;
    expect(checkBoroughPeople(p).join(" ")).toMatch(/control does not follow the seats/);
  });

  it("refuses a losing candidate linked to a councillor", () => {
    const p = people();
    const loser = p.wards[0]!.election!.candidates.find((c) => !c.elected)!;
    loser.councillor_id = p.wards[0]!.councillor_ids[0];
    expect(checkBoroughPeople(p).join(" ")).toMatch(/losing candidate is named/);
  });
});
