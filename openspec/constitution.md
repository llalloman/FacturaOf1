# OF1 Engineering Constitution

1. Every material behavior change SHALL have an approved change proposal and
   acceptance scenarios before implementation.
2. Every domain SHALL have one declared source of truth.
3. Frontend separation SHALL not be treated as an authorization boundary;
   backend permissions and tenant scoping are mandatory.
4. Automation SHALL use authenticated APIs or versioned events and SHALL NOT
   access application databases directly.
5. Payment application and external callbacks SHALL be idempotent.
6. Authorized fiscal documents SHALL never be mutated; corrections use the
   applicable fiscal process.
7. Sensitive identity documents, certificates, tokens, and WhatsApp sessions
   SHALL not be exposed in public URLs or committed to the repository.
8. A build or static check is not end-to-end evidence. Critical flows require
   API, permission, data-integrity, and user-flow verification.
9. Production data, migrations, and deployment changes require explicit
   backup, rollout, validation, and recovery evidence.
10. Unrelated user changes in the workspace SHALL be preserved.
