"use client";

import { useState, type ReactNode } from "react";
import type { LetterFact } from "@/lib/letter";
import type { CaseSetup } from "@/lib/makeYourCase";
import { MakeYourCase, type CaseWant } from "./MakeYourCase";

/** Make your case for the everyday services (bins and streets, libraries and leisure, housing): the reader picks one. */
export function ServiceCases({ cases, page }: { cases: { setup: CaseSetup; wants: CaseWant[]; facts: LetterFact[]; compare: ReactNode }[]; page: string }) {
  const [i, setI] = useState(0);
  const c = cases[i]!;
  return (
    <MakeYourCase
      key={c.setup.topic}
      id="case-services"
      setup={c.setup}
      wants={c.wants}
      facts={c.facts}
      page={page}
      compare={c.compare}
      intro={
        <>
          Want a service run differently? Pick one: here is who decides, how the council&rsquo;s priorities compare, and how to tell the people who decide.{" "}
          <span className="seg" role="group" aria-label="Service">
            {cases.map((x, j) => (
              <button key={x.setup.topic} type="button" aria-pressed={j === i} onClick={() => setI(j)}>
                {x.setup.subject}
              </button>
            ))}
          </span>
        </>
      }
    />
  );
}
