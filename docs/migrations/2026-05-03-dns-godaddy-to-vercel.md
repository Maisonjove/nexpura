# DNS migration — GoDaddy → Vercel-managed (2026-05-03)

Migrates authoritative DNS for `nexpura.com` from GoDaddy
(`ns63/ns64.domaincontrol.com`) to Vercel (`ns1/ns2.vercel-dns.com`).
The domain registration stays at GoDaddy — only the nameservers change.

**Scope (Joey's "Path B"):** preserve current DNS state exactly. No
email config changes. The pre-existing email auth setup (Resend DKIM
TXT, Resend bounce subdomain SPF/MX, Microsoft 365 inbound MX,
GoDaddy SPF + DMARC) carries across unchanged.

## Why

Closes the per-tenant subdomain SSL ops gap surfaced in PR #119:
- Wildcard cert `*.nexpura.com` could not be issued via Vercel
  while GoDaddy was authoritative — `POST /v4/certs` returned
  `dns_pretest_cns_not_using_vercel_ns_error` (DNS-01 challenge
  needs Vercel-managed DNS).
- Workaround had been to add each published tenant's subdomain
  individually (`POST /v10/projects/.../domains` per subdomain).
  Worked for the first 2 tenants (maisonjove, marcusco) but didn't
  scale.

Post-migration, Vercel auto-provisions a wildcard cert via DNS-01.
Future `website_config.published = true` flips for tenant subdomains
get SSL automatically with no operator intervention.

## Pre-migration audit baseline

Full GoDaddy DNS zone export at the moment of cutover, fetched via
`GET /v1/domains/nexpura.com/records` with the production API token
on 2026-05-03 21:25 UTC. 19 records across 6 record types:

```json
[
  {"type":"A","name":"@","data":"76.76.21.21","ttl":3600},
  {"type":"NS","name":"@","data":"ns63.domaincontrol.com","ttl":3600},
  {"type":"NS","name":"@","data":"ns64.domaincontrol.com","ttl":3600},
  {"type":"CNAME","name":"*","data":"cname.vercel-dns.com","ttl":3600},
  {"type":"CNAME","name":"email","data":"email.secureserver.net","ttl":3600},
  {"type":"CNAME","name":"lyncdiscover","data":"webdir.online.lync.com","ttl":3600},
  {"type":"CNAME","name":"msoid","data":"clientconfig.microsoftonline-p.net","ttl":3600},
  {"type":"CNAME","name":"sip","data":"sipdir.online.lync.com","ttl":3600},
  {"type":"CNAME","name":"www","data":"cname.vercel-dns.com","ttl":3600},
  {"type":"CNAME","name":"_domainconnect","data":"_domainconnect.gd.domaincontrol.com","ttl":3600},
  {"type":"MX","name":"@","data":"nexpura-com.mail.protection.outlook.com","priority":0,"ttl":3600},
  {"type":"MX","name":"send","data":"feedback-smtp.us-east-1.amazonses.com","priority":10,"ttl":3600},
  {"type":"TXT","name":"@","data":"NETORGFT20481118.onmicrosoft.com","ttl":3600},
  {"type":"TXT","name":"@","data":"v=spf1 include:secureserver.net -all","ttl":3600},
  {"type":"TXT","name":"resend._domainkey","data":"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCd+LLhzf0c5N5rBlYEEjCAJzgV3vi/9PnMV6hW/C/sZMts5SoulLONljcMitvOJ7it4PZlSgO3Ft1nll+hKUQYfgaUR0dSlpldbGf6a39bnZwd70Oqm8TMPoYzb2lFQRVB+I3r21Zqrm8vjabKRZHHEDiD+Dt2HwDFlKjOE+x0cQIDAQAB","ttl":3600},
  {"type":"TXT","name":"send","data":"v=spf1 include:amazonses.com ~all","ttl":3600},
  {"type":"TXT","name":"_dmarc","data":"v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;","ttl":3600},
  {"type":"SRV","name":"@","data":"sipdir.online.lync.com","priority":100,"weight":1,"port":443,"protocol":"_tls","service":"_sip","ttl":3600},
  {"type":"SRV","name":"@","data":"sipfed.online.lync.com","priority":100,"weight":1,"port":5061,"protocol":"_tcp","service":"_sipfederationtls","ttl":3600}
]
```

## Vercel-side staging

Vercel pre-stages 5 records on managed zones (3 CAA for cert
issuance + ALIAS @ and ALIAS *). 14 of the 19 GoDaddy records map
1:1 to Vercel adds (the 2 NS get replaced by Vercel's own NS, the
A @ and CNAME * are subsumed by Vercel's ALIAS records).

Records added at Vercel via `POST /v2/domains/nexpura.com/records`:

| Type | Name | Value | Priority | Vercel rec_id |
|---|---|---|---|---|
| CNAME | www | cname.vercel-dns.com | — | rec_c5bd864ad243d3c38e1c1453 |
| CNAME | email | email.secureserver.net | — | rec_74fba4687e64c95c04b77c8b |
| CNAME | lyncdiscover | webdir.online.lync.com | — | rec_4afd25a4768cf65e3a2a1b6d |
| CNAME | msoid | clientconfig.microsoftonline-p.net | — | rec_dcbd0ecf0664b966e3a4a8ff |
| CNAME | sip | sipdir.online.lync.com | — | rec_c47bb135bc15ae73096fbaf9 |
| CNAME | _domainconnect | _domainconnect.gd.domaincontrol.com | — | rec_5147eb3127e63b883de8940b |
| MX | @ | nexpura-com.mail.protection.outlook.com | 0 | rec_b3188337d6db4cb7de07af5a |
| MX | send | feedback-smtp.us-east-1.amazonses.com | 10 | rec_1632fdce85fc702fc038d866 |
| TXT | @ | NETORGFT20481118.onmicrosoft.com (M365 verif) | — | rec_e4842458448b5d6a9c28f1d9 |
| TXT | @ | v=spf1 include:secureserver.net -all (apex SPF) | — | rec_3c1d232bb338b12f13247c35 |
| TXT | resend._domainkey | p=MIGf… (Resend DKIM) | — | rec_31d57791fa25a546f9b2b242 |
| TXT | send | v=spf1 include:amazonses.com ~all (bounce SPF) | — | rec_3e7b47993fc3b27bd3387afd |
| TXT | _dmarc | v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=… | — | rec_a4bc475e138a9fd9f13ad484 |
| SRV | _sip._tls | 1 443 sipdir.online.lync.com | 100 | rec_d4dd4e2b56b81907443d4985 |
| SRV | _sipfederationtls._tcp | 1 5061 sipfed.online.lync.com | 100 | rec_25a666968ed260a8e236ddf2 |

## Cutover

`PATCH /v1/domains/nexpura.com {"nameServers":["ns1.vercel-dns.com","ns2.vercel-dns.com"]}` → HTTP 204
at **2026-05-03 21:26 UTC**.

> Worth noting: the GoDaddy docs imply `PUT` for this operation. PUT
> returns 404. PATCH is the working verb. Logged in
> `clients/joey/CREDS.md` for next time.

## Propagation timeline

- T+0 (21:26 UTC): cutover request accepted by GoDaddy
- T+0 (21:27 UTC): 1.1.1.1 (Cloudflare) returns Vercel NS
- T+30s (21:27:35 UTC): 8.8.8.8 (Google) returns Vercel NS
- Both major resolvers propagated in under 1 minute.

## Verification probes

### Existing surfaces — all 200, content unchanged

| URL | Status | Body title |
|---|---|---|
| https://nexpura.com/ | 200 | Nexpura — The Operating System for Modern Jewellers |
| https://nexpura.com/login | 200 | Nexpura — login |
| https://maisonjove.nexpura.com/ | 200 | Maison Jove — Fine Jewellery, Sydney |
| https://marcusco.nexpura.com/ | 200 | Marcus & Co. Fine Jewellery — Sydney |

### Wildcard SSL — the goal

Pre-cutover (any un-registered subdomain): SSL handshake aborts with
`error:0A000126:SSL routines::unexpected eof while reading`.

Post-cutover, after manually triggering DNS-01 issuance via
`POST /v4/certs {"cns":["*.nexpura.com","nexpura.com"]}` (returned
`cert_jAbYXiuvsFFKZFtz7L2Kdr0V`):

```
$ curl -i https://wildcardtest.nexpura.com/
HTTP/2 200
... (Nexpura's standard 404-not-tenant page)

$ openssl s_client -connect wildcardtest.nexpura.com:443 \
                   -servername wildcardtest.nexpura.com
subject=CN = *.nexpura.com
issuer=C = US, O = Let's Encrypt, CN = R13
Verify return code: 0 (ok)
```

### Email infrastructure preserved

- `dig MX nexpura.com @8.8.8.8` → `0 nexpura-com.mail.protection.outlook.com.` (Microsoft 365 inbound preserved)
- BEFORE test email (Joey-confirmed): forgot-password flow → email landed in Outlook
- AFTER test email (Joey-confirmed): same flow → email landed in Outlook
- Inbound test (Joey-confirmed): external email → @nexpura.com address landed in Outlook

### Deployment-audit gate — 5 P0 spot-checks on prod sha 50046dc

| Check | Result |
|---|---|
| G15 P0-A: PATCH role escalation → 403 + 42501 | PASS |
| G15 P0-B: cross-tenant SELECT → 1 row | PASS |
| G16 P0: /admin RSC streaming leak → 307 + 15B | PASS |
| G17: support_access rows in activity_log | PASS |
| G14: inventory-photos bucket RLS policies | PASS |

## Ops-gap closed

The `reference_vercel_domain_workflow.md` memory note and CREDS.md
each carry a note about a per-publish manual op-step (call Vercel
add-domain whenever a tenant publishes). That note is now obsolete:
publish flow gets SSL automatically via the DNS-01 wildcard.

The two existing per-subdomain registrations (maisonjove + marcusco
from PR #119) carry over — they continue to serve correctly post-
migration. They could be removed from the project domain list, but
no harm in leaving them; the wildcard cert covers them either way.

## Rollback

If anything broke post-migration, the rollback is symmetrical:
`PATCH /v1/domains/nexpura.com {"nameServers":["ns63.domaincontrol.com","ns64.domaincontrol.com"]}`.
Propagation back to GoDaddy NS takes a similar 5-15 min.

The 24h soak window covers any deferred email-deliverability
regressions that don't surface immediately. T+1h and T+24h re-check
points scheduled.

## Token rotation

GoDaddy production API token used for the migration (`h2Jp1j5kQft7…`)
is documented in `clients/joey/CREDS.md`. Joey rotates after the
24h soak completes — the token doesn't need to be live post-
migration since DNS is no longer at GoDaddy.
