# Branded transactional email via SES for equitaselite.com.
# Once the domain identity is DKIM-verified, Cognito (cognito.tf) sends
# invitation emails from noreply@equitaselite.com instead of the generic
# no-reply@verificationemail.com.

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# DKIM signing — three CNAMEs that prove SES is authorized to sign mail
# claiming to be from this domain.
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = aws_route53_zone.main.zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# TXT records at the apex.
#
# Route 53 treats all TXT values for the same name as one record set, so
# we keep both SPF and Google Workspace domain verification here:
#   - SPF authorizes amazonses.com (transactional from-app mail) and
#     _spf.google.com (Workspace) to send as @equitaselite.com. ~all =
#     soft-fail unauthorized senders (tighten to -all once we're certain
#     no other senders exist).
#   - google-site-verification is checked by Google Workspace setup; see
#     google-workspace.tf for the source of the value.
resource "aws_route53_record" "ses_spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 600
  records = [
    "v=spf1 include:amazonses.com include:_spf.google.com ~all",
    local.google_site_verification,
  ]
}

# DMARC — tells inbox providers what to do when SPF/DKIM fail.
# Ratchet path:
#   p=none                                  → monitor only (started 2026-05-13)
#   p=quarantine; pct=25                    → 25% of failures land in spam
#   p=quarantine; pct=100                   → full quarantine (2026-05-14)
#   p=reject;     pct=25 ← current          → partial reject (2026-05-15)
#   p=reject;     pct=100                   → full reject
# Aggregate reports go to dmarc-reports@; review them before each ratchet.
# Next step (p=reject; pct=100) should wait a few more days of clean
# aggregate reports — partial reject is the lower-blast-radius checkpoint.
resource "aws_route53_record" "ses_dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=reject; pct=25; rua=mailto:dmarc-reports@${var.domain_name}"]
}

# Block terraform apply until SES confirms the domain is verified.
# This usually takes 5-15 min once the DKIM CNAMEs are in place.
resource "aws_ses_domain_identity_verification" "main" {
  domain     = aws_ses_domain_identity.main.id
  depends_on = [aws_route53_record.ses_dkim]

  timeouts {
    create = "30m"
  }
}
