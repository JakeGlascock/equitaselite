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
