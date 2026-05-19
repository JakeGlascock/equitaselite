# Production alarms — small, opinionated set targeting the things that
# actually mean "something is wrong." All notifications go to the
# existing `security_alerts` SNS topic (provisioned in cloudtrail.tf),
# so subscribing one inbox covers every alarm in this account.
#
# Cost: each alarm is $0.10/month standard-resolution. With this set
# (~5 alarms here + rds_cpu in rds.tf), total CloudWatch alarm cost
# is ~$0.60/month. SNS email deliveries are free under the 1000/month
# threshold we'll never approach.
#
# The discipline: every alarm here should be high-signal — an actual
# page-worthy event. Resist the urge to add "informational" alarms
# (low CPU, low traffic, etc.) — they create fatigue and get ignored.

# 1. ALB 5xx rate. The single best signal that the app is broken
# at the request layer. Anything above ~5% sustained = something
# regressed in the last deploy or RDS is sick.
resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  alarm_name          = "${var.app_name}-${var.environment}-alb-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5
  alarm_description   = "ALB 5xx response rate >5% sustained for 10 minutes."
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
  ok_actions          = [aws_sns_topic.security_alerts.arn]
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "rate"
    expression  = "100 * (errs / IF(reqs > 0, reqs, 1))"
    label       = "5xx error rate (%)"
    return_data = true
  }
  metric_query {
    id = "errs"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix }
    }
  }
  metric_query {
    id = "reqs"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix }
    }
  }
}

# 2. Target unhealthy hosts. Fires when the LB stops being able to
# reach the ECS task on the health-check path. Distinct from 5xx —
# this catches "the task is gone" before users see errors.
resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${var.app_name}-${var.environment}-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "One or more ECS tasks failing ALB health check for 2 minutes — service likely down or restarting."
  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }
  alarm_actions      = [aws_sns_topic.security_alerts.arn]
  ok_actions         = [aws_sns_topic.security_alerts.arn]
  treat_missing_data = "notBreaching"
}

# 3. ECS running task count vs desired. If the service auto-scaled
# down OR a task crashed and the scheduler couldn't replace it,
# RunningTaskCount drops below DesiredCount. This is the canonical
# "the service is degraded" signal.
resource "aws_cloudwatch_metric_alarm" "ecs_running_count" {
  alarm_name          = "${var.app_name}-${var.environment}-ecs-running-below-desired"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "ECS service has zero running tasks for 2 minutes — production is down."
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.app.name
  }
  alarm_actions      = [aws_sns_topic.security_alerts.arn]
  ok_actions         = [aws_sns_topic.security_alerts.arn]
  treat_missing_data = "breaching"
}

# 4. RDS free storage. The class of bug that quietly creeps up over
# weeks and crashes everything on a Sunday. 5 GB threshold gives ~a
# week's headroom on the current allocation to scale up.
resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${var.app_name}-${var.environment}-rds-free-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5 * 1024 * 1024 * 1024  # 5 GB in bytes
  alarm_description   = "RDS free storage below 5 GB — scale storage soon, autoscale-storage is on but worth a heads-up."
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.id }
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
  ok_actions          = [aws_sns_topic.security_alerts.arn]
  treat_missing_data  = "notBreaching"
}

# Email subscription on the SNS topic so alarms actually reach a human.
# Confirmation is a one-time manual step: AWS sends a "Confirm
# subscription" email to the endpoint when this resource is created;
# the recipient clicks the link to activate. terraform succeeds either
# way — until confirmed, the subscription stays in PendingConfirmation
# state and alarms fire into the void.
#
# Address is a Google Workspace alias (alert@, singular — not alerts@).
# If the alias doesn't forward yet, create it before this resource is
# provisioned (or confirm via whichever address it's forwarded to).
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.security_alerts.arn
  protocol  = "email"
  endpoint  = "alert@${var.domain_name}"
}

# 5. RDS connection pressure. The pg Pool has a max — if we get close
# to RDS's per-instance max_connections, new requests start queueing
# or failing. db.t4g.medium tops out around 87 max_connections.
resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.app_name}-${var.environment}-rds-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 60   # ~70% of the t4g.medium ceiling (~87)
  alarm_description   = "RDS connection count above 60 sustained — pool leak or traffic spike. db.t4g.medium ceiling is ~87."
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.id }
  alarm_actions       = [aws_sns_topic.security_alerts.arn]
  ok_actions          = [aws_sns_topic.security_alerts.arn]
  treat_missing_data  = "notBreaching"
}
