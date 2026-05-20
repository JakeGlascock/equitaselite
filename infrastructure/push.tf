# SNS Mobile Push for the iOS app (Phase M2).
#
# The SNS Platform Application itself is created out-of-band in the AWS
# Console — Terraform CAN manage aws_sns_platform_application, but the
# resource takes the APNs .p8 contents as the `principal` attribute,
# and we don't want the key file flowing through TF state. Once you
# create the Platform Application manually and paste its ARN into the
# `apns_platform_app_arn` variable, this file scopes the Fargate task
# role to the exact set of SNS actions lib/push.ts performs.
#
# When apns_platform_app_arn is empty (the default), the policy is not
# created at all — `count = 0` keeps the resource absent so a fresh
# apply works without any Apple setup.

locals {
  push_enabled = var.apns_platform_app_arn != ""

  # Endpoint ARNs follow the pattern
  #   arn:aws:sns:REGION:ACCOUNT:endpoint/APNS/<app-name>/<endpoint-id>
  # but Terraform doesn't have the ACCOUNT id without a data source.
  # We allow Publish + SetEndpointAttributes against any SNS endpoint
  # in the account+region — IAM doesn't support resource scoping by
  # parent Platform Application natively, and the endpoints are only
  # ever created by our own CreatePlatformEndpoint call.
  sns_endpoint_arn_pattern = "arn:aws:sns:${var.aws_region}:*:endpoint/*"
}

resource "aws_iam_role_policy" "ecs_task_sns_push" {
  count = local.push_enabled ? 1 : 0

  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Endpoint lifecycle — scoped to the single Platform Application.
        Effect = "Allow"
        Action = [
          "sns:CreatePlatformEndpoint",
          "sns:GetEndpointAttributes",
        ]
        Resource = var.apns_platform_app_arn
      },
      {
        # Per-endpoint actions — scoped to endpoints in our account+region.
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:SetEndpointAttributes",
          "sns:DeleteEndpoint",
        ]
        Resource = local.sns_endpoint_arn_pattern
      },
    ]
  })
}
