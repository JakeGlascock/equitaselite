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

  # DKIM public key issued by Google Workspace for outbound Gmail signing.
  # Generated via admin.google.com -> Apps -> Google Workspace -> Gmail ->
  # Authenticate email -> Generate new record. If we ever rotate the key,
  # paste the new value here and `terraform apply`.
  google_dkim_value = "v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqoXNM2PqDBKgkLicZoUOzbpFSGJ2kcrMip6eO616x8LB3qPy8oZt+L1d95xFi4Vnd0lLt2H4x5ZMOARn3RW+Rtq/ObziVoYxGJjTe6YMuJX+M8/YGMd1Lu2gcGnls6xH15In6wmHkxXEmcRCIhHnKgsTQSKHPegnIqOLdTR/ejDxxfPylCkjo05D8kOZX2GbiJ/5z1SICIGs1QO8DQSQFLRx99x40/geBVv0FYvfr7LJhZZBfrftdxkbJYWPXdO+WFJCoGAW9i9MxISMa8cnZhe4CutN5odvwzox5OVL7rFSW6pedYwE7i83yle3hJgdav3SBbNueq6gXbwle+X84wIDAQAB"
}

# DKIM public key for outbound mail authentication. Route 53's per-string
# limit on TXT records is 255 chars, but the DKIM value is ~430. Split it
# into <=255-char chunks separated by "" — Route 53 stores them as a
# multi-string TXT record that resolvers reassemble.
resource "aws_route53_record" "google_dkim" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "google._domainkey.${var.domain_name}"
  type    = "TXT"
  ttl     = 3600
  records = [
    join("\"\"", [
      for i in range(0, length(local.google_dkim_value), 255) :
        substr(local.google_dkim_value, i, 255)
    ])
  ]
}
