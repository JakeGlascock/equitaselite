resource "aws_cognito_user_pool" "main" {
  name = "${var.app_name}-${var.environment}"

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
    email_sending_account = "DEVELOPER"
    source_arn            = aws_ses_email_identity.noreply.arn
    from_email_address    = "noreply@${var.domain_name}"
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

  lambda_config {
    pre_sign_up    = aws_lambda_function.cognito_pre_signup.arn
    post_confirmation = aws_lambda_function.cognito_post_confirm.arn
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

# Lambda stubs — deploy real code separately via CI/CD
resource "aws_lambda_function" "cognito_pre_signup" {
  function_name = "${var.app_name}-cognito-pre-signup-${var.environment}"
  role          = aws_iam_role.lambda_cognito.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = "${path.module}/lambda/cognito_presignup.zip"
  timeout       = 5

  environment {
    variables = {
      ALLOWED_DOMAINS = "equitaselite.com"
    }
  }
}

resource "aws_lambda_function" "cognito_post_confirm" {
  function_name = "${var.app_name}-cognito-post-confirm-${var.environment}"
  role          = aws_iam_role.lambda_cognito.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = "${path.module}/lambda/cognito_postconfirm.zip"
  timeout       = 5
}

resource "aws_iam_role" "lambda_cognito" {
  name = "${var.app_name}-lambda-cognito-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_cognito_basic" {
  role       = aws_iam_role.lambda_cognito.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_permission" "cognito_pre_signup" {
  statement_id  = "AllowCognitoInvokePreSignup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_post_confirm" {
  statement_id  = "AllowCognitoInvokePostConfirm"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_post_confirm.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
