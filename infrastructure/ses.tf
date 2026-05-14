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

# SPF — authorizes amazonses.com (transactional mail from the app) and
# _spf.google.com (Google Workspace at access@equitaselite.com) to send
# mail as @equitaselite.com. Published as TXT at the apex; ~all =
# soft-fail unauthorized senders (start permissive, tighten to -all once
# we're confident no other senders exist).
resource "aws_route53_record" "ses_spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com include:_spf.google.com ~all"]
}

# DMARC — tells inbox providers what to do when SPF/DKIM fail.
# p=none = monitor only (we get aggregate reports but nothing is rejected).
# Move to p=quarantine then p=reject after a few weeks of clean reports.
resource "aws_route53_record" "ses_dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none; rua=mailto:dmarc-reports@${var.domain_name}"]
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
