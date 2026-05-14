resource "aws_cognito_user_pool" "main" {
  name = "${var.app_name}-${var.environment}"

  auto_verified_attributes = ["email"]

  # MFA enforcement — required for SOC 2 / ISO 27001
  mfa_configuration = "ON"
  software_token_mfa_configuration {
    enabled = true
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
      email_subject = "Your Equitas Elite invitation"
      email_message = "You have been invited to Equitas Elite. Your username is {username} and your temporary password is {####}. Please log in and change it immediately."
      sms_message   = "Equitas Elite — username {username}, temporary password {####}"
    }
  }

  email_configuration {
    # Using Cognito's built-in mailer (no-reply@verificationemail.com).
    # To switch to branded SES sending: verify a domain identity (DNS records),
    # then change this back to DEVELOPER + source_arn = aws_ses_domain_identity.
    email_sending_account = "COGNITO_DEFAULT"
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

  access_token_validity  = 1
  id_token_validity      = 1
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

# SES identity for transactional email
resource "aws_ses_email_identity" "noreply" {
  email = "noreply@${var.domain_name}"
}

