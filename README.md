# Database release checks

Run from the repository root with Node.js and the pinned PGlite dependency. The test creates an in-memory PostgreSQL engine, installs minimal Supabase-compatible identity stubs, applies the checked-in SQL migrations in order and operates only on temporary test data.

```sh
npm install --prefix /tmp/voyage26-tests --no-save @electric-sql/pglite@0.6.0
NODE_PATH=/tmp/voyage26-tests/node_modules node tests/database.mjs
```

All 18 groups passed on 25 November 2026. The suite checks registration closure, verified email, age and agreement gates, renewal, access isolation, moderation, publication rights, scoring, duplicate reviews, the five-review ranking threshold, submission and report throttling, suspension, deletion, quota isolation, and a snapshot restore. It includes regression coverage for blank destination reviews and case variants in destination rankings.

## Before opening accounts

- [ ] Verify provider email delivery, recovery redirects, OAuth and logout on the owner's Supabase project.
- [ ] Repeat private record isolation and sync checks through the deployed client, using two test accounts and separate devices.
- [ ] Verify suspended users and revoked sessions through the deployed gateway and client.
- [ ] Export and restore a complete owner-managed database backup to a separate staging project, including Auth configuration and access policies. The PGlite snapshot test exercises only the disposable database.
- [ ] Complete the policies, operator contacts and moderation workflow. Test complaint intake and owner response.
- [ ] Check free-tier ceilings and expiry settings in each provider dashboard before enabling writes.
- [ ] Confirm public signup stays off until the preceding checks pass.

Additional groups verify read-only invitations and revocation, opt-in passport redaction, blocking, file validation and owner quotas, private export isolation, moderated comments and category scores.
