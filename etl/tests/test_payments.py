"""Payments ETL: reading both file layouts, the privacy rules, and reconciliation. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import payments as P  # noqa: E402
from xlsx import excel_date, read_xlsx  # noqa: E402

WB = (
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>{}</sheets></workbook>'
)
RELS = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{}</Relationships>'


def cell(ref: str, v) -> str:
    if v is None:
        return ""
    if isinstance(v, (int, float)):
        return f'<c r="{ref}"><v>{v}</v></c>'
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(v))}</t></is></c>'


def make_xlsx(path: Path, sheets: dict) -> None:
    with zipfile.ZipFile(path, "w") as z:
        entries, rels = [], []
        for i, (name, rows) in enumerate(sheets.items(), start=1):
            entries.append(f'<sheet name="{name}" sheetId="{i}" r:id="rId{i}"/>')
            rels.append(f'<Relationship Id="rId{i}" Target="worksheets/sheet{i}.xml" Type="x"/>')
            body = "".join(
                f'<row r="{ri}">' + "".join(cell(f"{chr(65 + ci)}{ri}", v) for ci, v in enumerate(r)) + "</row>"
                for ri, r in enumerate(rows, start=1)
            )
            z.writestr(f"xl/worksheets/sheet{i}.xml", f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{body}</sheetData></worksheet>')
        z.writestr("xl/workbook.xml", WB.format("".join(entries)))
        z.writestr("xl/_rels/workbook.xml.rels", RELS.format("".join(rels)))


MODERN = [
    ["Organisation", "Supplier Name", "Reference", "Payment Date", "Service Area/Capital Project Description", "GL Account Description", "Amount £ \n(Ex VAT)"],
    ["LBHF", "Acme Ltd", "2425.1.CPMT.1", 45383, "Parks and Leisure", "Grounds maintenance", 1200.5],
    ["LBHF", "Personal Data - Name Redacted", "2425.1.CPMT.2", 45384, "Care and Assessment Services", "Home care", 800],
    ["LBHF", "Mr A Smith T/A Acorn Lodge", "2425.1.CPMT.3", 45385, "Care and Assessment Services", "Residential", 950],
    ["LBHF", "Acme Ltd", "2425.1.CPMT.4", 45386, "Parks and Leisure", "Credit note", -200.5],
]
OLD = [
    ["organisation_name", "service", "directorate", "sub_division", "service_cat_uri", "beneficiary_name", "supp_id", "payment_date",
     "Inv_date", "transaction_number", "order_id", "net_amount", "purpose_of_spend", "procurement_name"],
    ["LBHF", "Highways", "Transport", "Roads", "TRA00", "Road Co Ltd", 1, 42103, 42100, 7, 0, 1000.25, "Repairs", "Repairs"],
    ["LBHF", "Housing Options", "Housing", "TA", "HAG90", "Individual Name redacted", 2, 42104, 42100, 8, 0, 300, "TA", "TA"],
    [None, None, None, None, None, None, None, None, None, None, None, 1300.25],
]


class ReadFiles(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def test_reads_the_2023_layout(self):
        f = self.tmp / "m.xlsx"
        make_xlsx(f, {"Data Q1": MODERN, "Notes": [["Notes"], ["Amounts shown exclude VAT"]]})
        rows, own = P.read_spend_file(f, "m")
        self.assertIsNone(own)
        self.assertEqual(len(rows), 4)
        self.assertEqual((rows[0].date, rows[0].supplier, rows[0].amount, rows[0].area), ("2024-04-01", "Acme Ltd", 1200.5, "Parks and Leisure"))
        self.assertEqual(rows[0].row, 2)  # the row number Excel shows, for tracing back to the file
        self.assertEqual(P.file_totals(rows), (4, 2750.0))

    def test_reads_the_2015_layout_and_its_own_total(self):
        f = self.tmp / "o.xlsx"
        make_xlsx(f, {"_control": [["*", "x"]], "Sheet1": OLD})
        rows, own = P.read_spend_file(f, "o")
        self.assertEqual(len(rows), 2)
        self.assertEqual(own, 1300.25)
        self.assertEqual(rows[0].directorate, "Transport")
        self.assertEqual(P.file_totals(rows)[1], own)

    def test_refuses_a_file_without_the_expected_columns(self):
        f = self.tmp / "bad.xlsx"
        make_xlsx(f, {"Data": [["Supplier", "When", "How much"], ["Acme", 45383, 10]]})
        with self.assertRaises(P.CheckFailed):
            P.read_spend_file(f, "bad")

    def test_excel_dates(self):
        self.assertEqual(excel_date(45383).isoformat(), "2024-04-01")
        f = self.tmp / "m.xlsx"
        make_xlsx(f, {"Data": MODERN})
        self.assertEqual(read_xlsx(str(f))["Data"][1][1], "Acme Ltd")


class Privacy(unittest.TestCase):
    def test_council_redactions_are_withheld(self):
        for n in ["Personal Data - Name Redacted", "Individual Name redacted", "Redacted - Sensitive Supplier/Service",
                  "Hotel/B&B/Decant Accomodation - Location Redacted", "Freehold/Ground rents - Address redacted"]:
            self.assertEqual(P.payee_class(n), "redacted", n)
        self.assertEqual(P.payee_class("Redactive Publishing Ltd"), "org")  # a real company, not a marker

    def test_people_are_withheld(self):
        for n in ["Mr J Smith", "Mrs Jane Smith", "John Smith", "J Smith", "J. Smith", "Smith, John", "Smith J", "Sir John Doe",
                  "Priya Sharma", "Kwame Mensah", "Agnieszka Nowak"]:
            self.assertEqual(P.payee_class(n), "person", n)

    def test_organisations_are_published(self):
        for n in ["Sage Care Ltd", "Sir John Lillie Primary", "Lady Margaret School", "Lord Consultants Limited", "Dr Smith & Partners",
                  "Amazon", "Notting Hill Genesis", "Sense", "One-time vendors"]:
            self.assertEqual(P.payee_class(n), "org", n)

    def test_payments_to_individuals_need_a_legal_entity(self):
        self.assertEqual(P.payee_class("Helping Hands Network", "Adults Community Direct Payments"), "person")  # org words are not enough here
        self.assertEqual(P.payee_class("Anchor Tutors", "Section 17 Other"), "person")
        self.assertEqual(P.payee_class("Anchor Tutors Ltd", "Section 17 Other"), "org")
        self.assertEqual(P.payee_class("Fostering Co", "Independent Fostering Agencies"), "org")

    def test_sole_traders_show_only_their_trading_name(self):
        self.assertEqual(P.trading_name("Mr A Smith T/A Acorn Lodge"), "Acorn Lodge")
        self.assertEqual(P.trading_name("Acme Ltd"), "Acme Ltd")
        self.assertEqual(P.trading_name("Acme Ltd T/A"), "Acme Ltd")
        self.assertEqual(P.payee_class("Mr A Smith T/A"), "person")
        self.assertEqual(P.payee_class("Mr A Smith T/A Acorn Lodge"), "org")


class Suppliers(unittest.TestCase):
    def test_ids_ignore_case_punctuation_and_limited(self):
        self.assertEqual(P.supplier_id("Sage Care Limited"), P.supplier_id("SAGE CARE LTD."))
        self.assertEqual(P.supplier_id("The F.M Conway Ltd"), "f-m-conway-ltd")

    def test_kind_decides_who_gets_a_page(self):
        self.assertEqual(P.supplier_kind("Acme Ltd"), "company")
        self.assertEqual(P.supplier_kind("Royal Borough of Kensington and Chelsea"), "public_body")
        self.assertEqual(P.supplier_kind("Central London Community Healthcare NHS Trust"), "public_body")
        self.assertEqual(P.supplier_kind("Ealing Mencap"), "charity")
        self.assertEqual(P.supplier_kind("Anchor Tutors"), "other")


class DraftMapping(unittest.TestCase):
    def test_draft_rules(self):
        self.assertEqual(P.draft_group("Capital - Hammersmith Bridge Stabilisation", "")[0], "capital")
        self.assertEqual(P.draft_group("Voids & Repairs", "")[0], "council_homes")
        self.assertEqual(P.draft_group("Allocations & Lettings (GF)", "")[0], "housing")
        self.assertEqual(P.draft_group("Budget Planning and Monitoring", "LBHF Corporate Finance and Systems")[0], "running")
        self.assertEqual(P.draft_group("Strategic Head of Neighbourhoods", "")[0], "council_homes")
        self.assertEqual(P.draft_group("Something new", "")[0], "unclassified")


class Reconcile(unittest.TestCase):
    """The committed build adds back up to every file: published rows plus withheld totals."""

    def test_committed_build_reconciles(self):
        if not (P.OUT / "index.json").exists():
            self.skipTest("no payments build")
        self.assertEqual(P.reconcile_committed(P.load_registry()), [])


if __name__ == "__main__":
    unittest.main()
