# CloudTrail captures all API calls — required for SOC 2 CC7 / ISO 27001 A.12.4
resource "aws_cloudtrail" "main" {
  name                          = "${var.app_name}-${var.environment}"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  kms_key_id                    = aws_kms_key.logs.arn

  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail.arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.documents.arn}/"]
    }
  }

  depends_on = [aws_s3_bucket_policy.cloudtrail]
}

resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "/aws/cloudtrail/${var.app_name}-${var.environment}"
  retention_in_days = var.retention_days
  kms_key_id        = aws_kms_key.logs.arn
}

resource "aws_iam_role" "cloudtrail" {
  name = "${var.app_name}-cloudtrail-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "cloudtrail.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "cloudtrail" {
  role = aws_iam_role.cloudtrail.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
    }]
  })
}

# CloudWatch alarms on CloudTrail events for SOC 2 anomaly detection
locals {
  cloudtrail_alarms = {
    root-login          = { pattern = "{ $.userIdentity.type = \"Root\" && $.eventType != \"AwsServiceEvent\" }", desc = "Root account login detected" }
    console-no-mfa      = { pattern = "{ $.eventName = \"ConsoleLogin\" && $.additionalEventData.MFAUsed != \"Yes\" }", desc = "Console login without MFA" }
    iam-policy-change   = { pattern = "{ $.eventName = \"DeleteGroupPolicy\" || $.eventName = \"DeleteRolePolicy\" || $.eventName = \"DeleteUserPolicy\" || $.eventName = \"PutGroupPolicy\" || $.eventName = \"PutRolePolicy\" || $.eventName = \"PutUserPolicy\" }", desc = "IAM policy change" }
    kms-key-deletion    = { pattern = "{ $.eventSource = \"kms.amazonaws.com\" && ($.eventName = \"DisableKey\" || $.eventName = \"ScheduleKeyDeletion\") }", desc = "KMS key disabled or scheduled for deletion" }
    cloudtrail-disabled = { pattern = "{ $.eventName = \"StopLogging\" }", desc = "CloudTrail logging disabled" }
  }
}

resource "aws_cloudwatch_log_metric_filter" "cloudtrail" {
  for_each       = local.cloudtrail_alarms
  name           = "${var.app_name}-${each.key}"
  pattern        = each.value.pattern
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name

  metric_transformation {
    name      = each.key
    namespace = "${var.app_name}/CloudTrailAlerts"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "cloudtrail" {
  for_each            = local.cloudtrail_alarms
  alarm_name          = "${var.app_name}-${var.environment}-${each.key}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = each.key
  namespace           = "${var.app_name}/CloudTrailAlerts"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = each.value.desc
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
}

resource "aws_sns_topic" "security_alerts" {
  name              = "${var.app_name}-${var.environment}-security-alerts"
  kms_master_key_id = aws_kms_key.secrets.id
}
