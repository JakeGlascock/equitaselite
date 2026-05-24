resource "aws_cognito_user_pool" "main" {
  name = "${var.app_name}-${var.environment}"

  auto_verified_attributes = ["email"]

  # MFA enforcement — required for SOC 2 / ISO 27001
  mfa_configuration = "ON"
  software_token_mfa_configuration {
    enabled = true
  }

  # Device tracking — lets users opt into "Trust this device for 30 days"
  # during MFA. Subsequent signins from a confirmed + remembered device
  # take the DEVICE_SRP_AUTH path and skip the TOTP challenge.
  # `device_only_remembered_on_user_prompt = true` means devices stay
  # untrusted until the user explicitly opts in — without the checkbox
  # tick we ConfirmDevice but do NOT call UpdateDeviceStatus(remembered),
  # so MFA still fires next time. Mirrors standard B2B SaaS UX.
  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }

  password_policy {
    minimum_length                   = 16
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 1
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
    invite_message_template {
      email_subject = "Your invitation to Equitas Elite"
      # Branded HTML invite. Cognito substitutes {username} (the email)
      # and {####} (one-time temporary password) at send time.
      # Cognito message size limit is 20 KB; this template is well under.
      email_message = <<-EOT
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your invitation to Equitas Elite</title></head>
        <body style="margin:0;padding:0;background:#031427;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#bec6e0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#031427;padding:32px 16px;">
            <tr><td align="center">
              <table role="presentation" width="100%" style="max-width:540px;background:rgba(16,32,52,0.8);border:1px solid rgba(69,70,77,0.5);border-radius:12px;">
                <tr><td style="padding:32px 32px 8px 32px;">
                  <p style="margin:0;font-family:'IBM Plex Sans',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#8892a4;">Equitas Elite · Invitation</p>
                </td></tr>
                <tr><td style="padding:8px 32px 0 32px;">
                  <h1 style="margin:0 0 16px 0;font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:600;color:#e9c176;">You're invited</h1>
                  <p style="margin:0 0 12px 0;color:#bec6e0;font-size:15px;line-height:1.5;">
                    Equitas Elite is a private, invitation-only platform that
                    matches angel investors with family offices on mandate
                    alignment.
                  </p>
                  <p style="margin:0 0 12px 0;color:#bec6e0;font-size:15px;line-height:1.5;">
                    Your account is ready. Sign in with the credentials below;
                    you'll be asked to set a new password and pair an authenticator
                    app on first use.
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background:rgba(255,255,255,0.04);border:1px solid rgba(69,70,77,0.5);border-radius:8px;width:100%;">
                    <tr><td style="padding:12px 16px;color:#8892a4;font-family:'IBM Plex Sans',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">Email</td><td style="padding:12px 16px 12px 0;color:#bec6e0;font-family:'IBM Plex Mono',monospace;font-size:13px;word-break:break-all;">{username}</td></tr>
                    <tr><td style="padding:12px 16px;border-top:1px solid rgba(69,70,77,0.3);color:#8892a4;font-family:'IBM Plex Sans',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">Temporary password</td><td style="padding:12px 16px 12px 0;border-top:1px solid rgba(69,70,77,0.3);color:#e9c176;font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:0.05em;">{####}</td></tr>
                  </table>
                  <p style="margin:0 0 12px 0;color:#8892a4;font-size:13px;line-height:1.5;">
                    The temporary password expires in 7 days. After signing in
                    you'll set a permanent password and configure TOTP-based
                    two-factor authentication.
                  </p>
                </td></tr>
                <tr><td align="center" style="padding:24px 32px 32px 32px;">
                  <a href="https://${var.domain_name}/signin"
                     style="display:inline-block;background:#e9c176;color:#031427;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
                    Sign in to Equitas Elite
                  </a>
                </td></tr>
                <tr><td style="padding:0 32px 24px 32px;border-top:1px solid rgba(69,70,77,0.4);">
                  <p style="margin:16px 0 6px 0;font-size:11px;color:#8892a4;line-height:1.6;">
                    You're receiving this because an Equitas Elite administrator
                    invited <strong style="color:#bec6e0;">{username}</strong> to the platform.
                    If you weren't expecting this, you can ignore the message —
                    no account will be activated until you sign in.
                  </p>
                  <p style="margin:0 0 12px 0;font-size:11px;color:#8892a4;line-height:1.6;">
                    <a style="color:#8892a4;text-decoration:underline;" href="https://${var.domain_name}/privacy">Privacy</a>
                  </p>
                  <p style="margin:0;font-size:10px;color:#5a6378;line-height:1.6;">
                    Equitas Elite · 1209 N Orange St, Wilmington, DE 19801, USA
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
        EOT
      sms_message   = "Equitas Elite — username {username}, temporary password {####}"
    }
  }

  email_configuration {
    email_sending_account = "DEVELOPER"
    source_arn            = aws_ses_domain_identity.main.arn
    from_email_address    = "Equitas Elite <system@${var.domain_name}>"
  }

  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }

  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 32
    }
  }

  schema {
    name                = "firm_name"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 128
    }
  }

  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.app_name}-web-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  auth_session_validity                = 3

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # Pre-launch session lifetime: 24h on access/id tokens (Cognito's max
  # for these). One sign-in per day, no surprise mid-day kicks, no
  # client-side refresh plumbing needed. Shorten BEFORE first paying
  # customer onboards — for an institutional product 1-4h with auto-
  # refresh is the right shape. Tracked in
  # project_equitaselite_nice_to_haves.md.
  access_token_validity  = 24
  id_token_validity      = 24
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  callback_urls = [
    "https://${var.domain_name}/auth/callback",
    "https://staging.${var.domain_name}/auth/callback",
  ]

  logout_urls = [
    "https://${var.domain_name}/login",
    "https://staging.${var.domain_name}/login",
  ]

  supported_identity_providers = ["COGNITO"]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.app_name}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

