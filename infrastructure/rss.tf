# RSS-poller schedule.
#
# Every 6 hours, EventBridge launches a one-off ECS Fargate task that
# runs `node scripts/rss-poll.mjs` against the same task definition +
# image as the main app service. The script fetches every active
# rss_feeds row, parses the XML, and inserts new headlines into
# rss_items with a (feed_id, guid) UNIQUE-conflict dedupe.

resource "aws_cloudwatch_event_rule" "rss_poll" {
  name                = "${var.app_name}-rss-poll-${var.environment}"
  description         = "Poll curated RSS feeds, populate rss_items"
  schedule_expression = "cron(0 */6 * * ? *)"  # every 6 hours
  state               = "ENABLED"
}

# Mirror the digest_scheduler role — separate scope, RunTask-only, no
# human / console use. Stays scoped to the equitaselite-prod cluster.
resource "aws_iam_role" "rss_scheduler" {
  name = "${var.app_name}-rss-scheduler-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "events.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "rss_scheduler_run_task" {
  name = "events-run-rss-task"
  role = aws_iam_role.rss_scheduler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "RunTaskOnMainCluster"
        Effect   = "Allow"
        Action   = "ecs:RunTask"
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

resource "aws_cloudwatch_event_target" "rss_poll" {
  rule     = aws_cloudwatch_event_rule.rss_poll.name
  role_arn = aws_iam_role.rss_scheduler.arn
  arn      = aws_ecs_cluster.main.arn
  ecs_target {
    # Family-only ARN — auto-resolves to the latest deployed revision
    task_definition_arn = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${aws_ecs_task_definition.app.family}"
    launch_type         = "FARGATE"
    platform_version    = "LATEST"
    network_configuration {
      subnets          = aws_subnet.private_app[*].id
      security_groups  = [aws_security_group.app.id]
      assign_public_ip = false
    }
  }

  input = jsonencode({
    containerOverrides = [{
      name    = "app"
      command = ["node", "scripts/rss-poll.mjs"]
    }]
  })
}
