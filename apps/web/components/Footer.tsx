import { ALLOW_TEST_DATA } from "@/lib/quality";

export function Footer({ council, hasTestData }: { council: string; hasTestData: boolean }) {
  return (
    <footer>
      <span>Borough Ledger is an independent project. It is not run by, endorsed by or affiliated with {council} Council.</span>
      {hasTestData && ALLOW_TEST_DATA ? <span>Prototype for design review. Do not quote any figure marked test.</span> : null}
    </footer>
  );
}
