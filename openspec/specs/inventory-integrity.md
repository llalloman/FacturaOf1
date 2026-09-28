# Inventory integrity and operational flow

## Requirement: Inventory ownership and scope

Inventory SHALL be isolated by company and SHALL support multiple warehouses.
Each warehouse MAY be associated with an establishment, but warehouse stock
and fiscal emission points are different concepts.

## Requirement: Product inventory policy

Each product SHALL declare whether it is a good or service and whether it
manages inventory. Services and non-stock products SHALL never create stock
movements. Stock products SHALL use a consistent unit of measure and quantity
precision.

## Requirement: Single movement ledger

The inventory movement ledger SHALL be the source of truth for stock changes.
Supported causes SHALL include purchase receipt, sale, purchase return, sales
return, adjustment, transfer-out, and transfer-in. Current stock by product and
warehouse SHALL be a projection that can be reconciled from the ledger.

## Requirement: Transactional stock changes

A stock-affecting operation SHALL create its movement and update the stock
projection atomically. Concurrent operations SHALL lock the affected product,
warehouse, and lot rows. The system SHALL reject insufficient stock unless an
explicit negative-stock policy is enabled for that company.

## Requirement: Purchase-to-stock flow

The operational flow SHALL be:

```text
Purchase order → receipt → lot/cost capture → inventory entry
              → payable → treasury payment → accounting
```

A purchase order alone SHALL not increase stock. Only a confirmed receipt
shall do so, and repeated confirmation SHALL be idempotent.

## Requirement: Sale-to-stock-and-finance flow

The operational flow SHALL be:

```text
Order / sale → reserve or validate stock → stock exit
            → invoice, if applicable → receivable or collection
            → treasury → accounting
```

The chosen warehouse SHALL be explicit or come from a documented operational
context. It SHALL belong to the same company as the sale. Sale retries,
invoice retries, and payment retries SHALL not duplicate stock movements or
financial effects.

## Requirement: Lots, expiry, and valuation

Products with expiry control SHALL consume valid lots using FEFO or an
explicitly configured policy. Expired lots SHALL not be sold. The system SHALL
preserve lot, unit cost, and movement references for traceability. Inventory
valuation SHALL use one declared company policy, such as weighted average or
FIFO, and the cost of sale SHALL be reproducible from the movement ledger.

## Requirement: Transfers and returns

Warehouse transfers SHALL be represented as a controlled document with origin,
destination, quantities, dispatch, receipt, and responsible users. A transfer
SHALL not duplicate stock when retried. Returns SHALL reference the original
sale or purchase where available and SHALL create explicit reverse movements.

## Requirement: Accounting and audit integration

Stock entries, exits, cost of sales, and adjustments SHALL be linkable to
accounting entries and operational documents. Manual adjustments SHALL require
a reason, responsible user, approval policy, and audit record. Historical
movements SHALL not be silently deleted or rewritten.

## Required reconciliation scenarios

- stock projection equals the movement ledger by product and warehouse;
- confirmed receipt increases stock once;
- completed sale decreases stock once;
- failed or retried invoice processing does not duplicate stock;
- transfer preserves total company stock;
- FEFO never consumes expired or unrelated-company lots;
- returned goods create traceable reverse movements;
- product, warehouse, lot, and document all belong to the same company.
