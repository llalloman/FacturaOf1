# Discount consistency

## Requirement: Detail-level discount is the source of truth

Fiscal and ERP calculations SHALL represent a commercial discount once at the
detail level. Each detail SHALL preserve:

```text
gross base
discount amount
net taxable base
tax
line total
```

The discount SHALL be a monetary amount, not a second percentage application.
The net taxable base SHALL be calculated as:

```text
net base = gross base - detail discount
```

## Requirement: Invoice discount consolidation

When a sale is converted into an electronic invoice:

- invoice detail discounts SHALL be copied from the sale details;
- `Factura.total_descuento` SHALL equal the sum of detail discounts;
- the invoice total SHALL be calculated from net detail bases plus taxes;
- the invoice SHALL not subtract `total_descuento` again from bases that are
  already net of detail discounts;
- the invoice total SHALL match the sale total within the approved fiscal
  rounding tolerance.

### Scenario: Signature sale with promotion or coupon

- GIVEN a signature with a regular price and a lower final price
- WHEN the approved payment creates a sale and the sale is converted to an
  invoice
- THEN the difference between regular and final taxable bases SHALL be recorded
  once as the detail discount
- AND the invoice total SHALL equal the paid sale total
- AND the SRI XML SHALL contain the detail discount and the net line base.

### Scenario: Signature sale without discount

- GIVEN a signature whose final price equals its regular price
- WHEN the sale is converted into an invoice
- THEN the detail discount SHALL be zero
- AND the invoice total SHALL equal the sale total.

### Scenario: Multiple discounted details

- GIVEN a sale with multiple details and different discounts
- WHEN the sale is converted into an invoice
- THEN `Factura.total_descuento` SHALL equal the sum of all detail discounts
- AND no detail discount SHALL be applied a second time.

## Requirement: Conversion failure evidence

If a sale and its generated invoice do not reconcile, the system SHALL preserve
the sale, invoice draft, calculated totals, and a diagnostic message. It SHALL
not hide the discrepancy as a generic rounding error.
