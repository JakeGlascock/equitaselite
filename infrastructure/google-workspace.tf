# Google Workspace inbox for access@equitaselite.com (and any other
# @equitaselite.com mailboxes added later via the Workspace admin console).
#
# After this applies, finish setup at admin.google.com:
#   1. Verify domain ownership when prompted (Google issues a unique
#      google-site-verification=XXX TXT record — add it ad-hoc via the
#      Route 53 console or by adding an aws_route53_record here)
#   2. Generate DKIM in Workspace (Apps -> Google Workspace -> Gmail ->
#      Authenticate email) and add the resulting google._domainkey TXT
#      record (a follow-up commit will pin it here once the value is
#      known)

# Modern single-record MX (replaces the historical 5-record ASPMX.L.GOOGLE.COM
# setup). Google rolled this out in 2023; ASPMX.L.GOOGLE.COM still works
# for legacy tenants but new setups should use SMTP.GOOGLE.COM.
resource "aws_route53_record" "google_workspace_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 3600
  records = ["1 SMTP.GOOGLE.COM."]
}

# Domain ownership verification for Google Workspace. Workspace's "Activate
# Gmail" / "Verify domain" flow polls for this TXT at the apex.
#
# Note: the SPF record (ses.tf) is also a TXT at the apex. Route 53 stores
# multiple TXT records on the same name as one record set with multiple
# values — but we manage them through two different aws_route53_record
# resources here, which is NOT allowed in Route 53. The workaround is to
# put BOTH values in the single SPF resource, OR put the verification TXT
# under a subdomain. Google accepts it at the apex only, so we merge it
# into the SPF record by listing both values.
#
# The actual record set is defined alongside the SPF in ses.tf to keep
# Route 53 happy. This file documents the source of the verification value
# for traceability.
locals {
  google_site_verification = "google-site-verification=F2wPgkIW531tJLtiQ5-oiCLo2amYi4x12KnrH_mrGAI"
}
