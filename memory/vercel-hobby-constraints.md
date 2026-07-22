# Vercel Hobby: two constraints that silently block deploys / speed

**1. Commit author must own the project (private repos).** Hobby has no collaborators, so a
deployment whose commit author resolves to a *different* GitHub user is rejected:
> "Deployment was blocked because the commit author did not have contributing access."

Two deploys shipped nothing before we noticed — the site kept serving a 42-hour-old build while
`git push` reported success. **The push succeeding tells you nothing about the deploy.** Verify:
```bash
DEP=$(gh api repos/<owner>/<repo>/deployments --jq '.[0].id')
gh api repos/<owner>/<repo>/deployments/$DEP/statuses --jq '.[].state'
```
Fix = author commits as the project owner:
```bash
git config --local user.email "<id>+<user>@users.noreply.github.com"   # gh api user --jq .id
```
(Watch out: `UID=$(...)` silently fails in bash — `UID` is readonly. Use another name.)

**2. `"regions"` in `vercel.json` is not allowed on Hobby — it BLOCKS the deploy.** Set the
function region in the dashboard instead (Project → Settings → Functions).

**Read `X-Vercel-Id` to find where code actually runs**: `bom1::iad1` means the request hit the
Mumbai *edge* but executed in US-East. Edge PoP ≠ function region — a no-DB function still cost
~0.35s from India because compute sat in Virginia. For an India-only audience, co-locate
functions **and** Postgres in Mumbai; that beats any query micro-optimization.

Related: [[hailmary-project]].
