# VoyageXXVI · GitHub Pages migration

**Destination** https://voyagexxvi.github.io/  
**Repository** https://github.com/voyagexxvi/voyagexxvi.github.io  
**Source release** f5576fccd734a1a831dbfea829999cca68834c89  
**Public launch** Free guest atlas. Accounts use an optional owner-operated Supabase Free project. No ChatGPT runtime, session, API key or credit balance is involved.

## Publish the complete repository
1. Unzip the package on your device. The extracted repository root contains README.md, START-HERE.md, dist, database, docs, scripts, tests and .github/workflows/pages.yml. Keep the V26 logo assets and map licences together with the atlas.
2. Open the existing public organization repository identified above. On a computer, clone it with GitHub Desktop, then copy the extracted contents into that checkout, including hidden files. Retain its .git directory. Review any existing files that have the same names in the Changes tab before committing. On iPad, a Git client that supports GitHub organization repositories can perform the same clone, copy, commit and push. A ZIP committed as one file cannot publish the atlas.
3. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. This route uses the public repository on GitHub Free. Verify the organization's Actions settings allow the GitHub-owned Pages actions. The workflow listens on main. If the existing default branch has a different name, change the branch in .github/workflows/pages.yml before pushing.
4. Commit the reviewed changes and push. Open **Actions → Deploy VoyageXXVI public atlas**. If the commit preceded the Pages configuration, choose **Run workflow** on the deployment branch. Follow the deployment link after the publish job succeeds.
5. Open the destination in a private tab. Confirm the VoyageXXVI wordmark, Enter the World, pinch zoom, country selection, Dhaka search, Street detail and Download source. Revisit the political atlas offline after loading it once. Internet service is required to fetch uncached street tiles.

### iPad alternative for publishing the public atlas
If your uploader hides .github, use a separate publication branch. Create it from the repository's current branch, upload **the contents inside dist** into its root, and preserve the directory structure. Confirm index.html, brand.png, app.js and the atlas folder sit at the same level. Back up or review same-name files first. Select **Settings → Pages → Deploy from a branch**, select that publication branch, choose **/(root)** and save. Keep the complete source ZIP as a separate backup. This method bypasses the workflow. To connect accounts using this method, generate dist/config.js with scripts/configure.mjs before uploading, or edit config.js with the public values described below.

## Connect accounts and PostgreSQL
1. The source deployment had a blank Supabase URL and key. There is no connected production member database identified by that configuration. The ZIP contains the full four SQL migrations, not a dump of someone’s private travel records. Hosted ChatGPT sign-in sessions do not become Supabase accounts. If you independently connected an existing Voyage database, reuse that dedicated project and its original Auth identities. Back it up and check installed migrations before applying any new versions. Never rerun the entire schema over a populated database.
2. For a new backend, create a dedicated Supabase **Free** project in your account. Keep public signup off in Auth. Run database/migrations/001_voyage.sql, 002_traveller.sql, 003_quota.sql and 004_comments.sql once each, in that order. These install privacy policies, moderation, quotas and a database-level gate on signup in this project.
3. In Supabase Authentication URL Configuration, set the Site URL to https://voyagexxvi.github.io/ and allow that exact redirect. Set up production-capable email delivery under a free plan before enabling email verification or password recovery for the public. Supabase's default mailer is restricted. For optional Google login, follow docs/OWNER.md and use the callback URL displayed by Supabase in your Google OAuth configuration.
4. In GitHub **Settings → Secrets and variables → Actions → Variables**, set SUPABASE_URL to the HTTPS project URL and SUPABASE_PUBLISHABLE_KEY to its publishable key. For configured Google login add VOYAGE_GOOGLE_OAUTH with value true. Run the workflow again. These two Supabase client values are public by design. Database passwords, service-role keys, secret keys, SMTP credentials and Google client secrets belong outside the repo and the website.
5. For a branch-based deployment, the equivalent config.js contains window.VOYAGE_CONFIG with url, key and google properties. The default empty strings intentionally launch guest mode. With GitHub Actions, each deployment regenerates this file from the repository variables. Set up these variables again if transferring to another repository.
6. Complete docs/OWNER.md and tests/README.md before opening registration. Test two accounts on staging, agreement versions, account isolation, recovery, moderation and deletion. Leave both provider signup and the database registration switch closed until owner legal review and production testing are complete. The atlas can launch immediately.
7. Free service limits may interrupt street maps, authentication, email or database writes. The local atlas ships with its own geographic data. Choose free plans only and leave paid upgrades and metered add-ons off.

## Portability and rollback
This export makes no changes to the original domain. Keep both sites available while verifying the new one. Browser theme choices, cached maps and layer presets belong to each origin and start fresh on GitHub Pages. Keep the ZIP and independent encrypted database backups. To roll back a GitHub release, revert its deployment commit and publish again. See docs/RECOVERY.md for the separate database restoration process. GitHub Pages does not process dist/_headers. The HTML files include a Content Security Policy and referrer policy for Pages. Host-level response headers depend on the hosting provider.

## References
- [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Auth email delivery](https://supabase.com/docs/guides/auth/auth-smtp)
- [Release checklist and inherited limitations](docs/CHECKLIST.md)
