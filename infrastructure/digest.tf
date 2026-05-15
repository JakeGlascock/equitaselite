# Weekly match-digest schedule.
#
# Every Monday at 14:00 UTC (9am ET / 6am PT / 4pm CET), EventBridge
# launches a one-off ECS Fargate task that runs `node scripts/digest.mjs`
# against the same task definition + image as the main app service.
# The script finds users with email_notifications_enabled=TRUE and at
# least one new opposite-role profile since their last_sent_at, emails
# them via SES, and stamps match_digest_state.last_sent_at on success.

resource "aws_cloudwatch_event_rule" "match_digest" {
  name                = "${var.app_name}-match-digest-${var.environment}"
  description         = "Weekly match-digest email run"
  schedule_expression = "cron(0 14 ? * MON *)"
  state               = "ENABLED"
}

# EventBridge needs its own role to launch the ECS task on a schedule.
# This role is intentionally separate from the deploy role — narrower
# scope (RunTask only, on this cluster only), no human use, no console.
resource "aws_iam_role" "digest_scheduler" {
  name = "${var.app_name}-digest-scheduler-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "events.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "digest_scheduler_run_task" {
  name = "events-run-digest-task"
  role = aws_iam_role.digest_scheduler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RunTaskOnMainCluster"
        Effect = "Allow"
        Action = "ecs:RunTask"
        # ecs:cluster condition pins this to our cluster — RunTask can't be
        # used to launch tasks elsewhere.
        Resource = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${aws_ecs_task_definition.app.family}:*"
        Condition = {
          ArnEquals = { "ecs:cluster" = aws_ecs_cluster.main.arn }
        }
      },
      {
        Sid    = "PassTaskRoles"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.ecs_execution.arn,
          aws_iam_role.ecs_task.arn,
        ]
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      },
    ]
  })
}

resource "aws_cloudwatch_event_target" "match_digest" {
  rule     = aws_cloudwatch_event_rule.match_digest.name
  role_arn = aws_iam_role.digest_scheduler.arn
  arn      = aws_ecs_cluster.main.arn
  # Family-only ARN — EventBridge resolves to the latest ACTIVE revision
  # at firing time, so the digest always runs against the most recently
  # deployed image.
  ecs_target {
    task_definition_arn = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${aws_ecs_task_definition.app.family}"
    launch_type         = "FARGATE"
    platform_version    = "LATEST"
    network_configuration {
      subnets          = aws_subnet.private_app[*].id
      security_groups  = [aws_security_group.app.id]
      assign_public_ip = false
    }
  }

  # Container override: same image, but run the digest script instead of
  # the default Next.js server.
  input = jsonencode({
    containerOverrides = [{
      name    = "app"
      command = ["node", "scripts/digest.mjs"]
    }]
  })
}
