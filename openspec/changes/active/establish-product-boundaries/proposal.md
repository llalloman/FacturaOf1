# Proposal: Establish OF1 product boundaries

## Problem

The current web-admin and Superadmin role combine platform administration,
tenant ERP operations, Firmador administration, and Automation coordination.
This causes context switching, unclear ownership, and permissions that do not
match the business boundaries.

## Goal

Define and implement independent product experiences for OF1 Solutions Admin,
FacturaOF1 + Firmador, and Automation while preserving a modular shared backend
as the initial transition architecture.

## Scope

- Root Spec-Driven catalog and governance.
- Product ownership and source-of-truth rules.
- Independent frontend build/deployment targets.
- Backend API and permission boundaries.
- Automation API/event contract.
- Migration plan for existing Superadmin routes.

## Out of scope for the first increment

- Immediate microservice extraction.
- Immediate database splitting.
- Destructive data migration.
- Removing existing routes before replacement verification.
