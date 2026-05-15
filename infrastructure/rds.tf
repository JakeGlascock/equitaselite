resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-${var.environment}"
  subnet_ids = aws_subnet.private_data[*].id
  tags       = { Name = "${var.app_name}-db-subnet-group" }
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.app_name}-${var.environment}-pg17"
  family = "postgres17"

  # rds.force_ssl is a static parameter — AWS only applies it on reboot. We
  # set apply_method explicitly so `terraform plan` doesn't drift forever
  # between Terraform's default ("immediate") and AWS's enforced value
  # ("pending-reboot"). All four static log_* + pgaudit params get the
  # same treatment to keep the parameter group's plan clean.
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "log_connections"
    value        = "1"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "log_disconnections"
    value        = "1"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "log_statement"
    value        = "ddl"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "pgaudit.log"
    value        = "write,ddl"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "main" {
  identifier        = "${var.app_name}-${var.environment}"
  engine            = "postgres"
  engine_version    = "17"
  instance_class    = var.db_instance_class
  allocated_storage = 100
  storage_type      = "gp3"
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn

  # Auto-scale storage up to 500 GB if usage approaches the allocated cap.
  # AWS does not allow shrinking — this is a one-way ceiling. 500 GB is
  # generous for a profile-table app; revisit if growth runs against it.
  max_allocated_storage = 500

  db_name  = var.db_name
  username = var.db_username
  password = aws_secretsmanager_secret_version.db_password.secret_string

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  multi_az               = true
  publicly_accessible    = false
  deletion_protection    = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "${var.app_name}-${var.environment}-final"

  backup_retention_period = 35
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  auto_minor_version_upgrade          = true
  copy_tags_to_snapshot               = true
  iam_database_authentication_enabled = true

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.rds.arn
  performance_insights_retention_period = 7
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.app_name}-rds-monitoring-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.app_name}-${var.environment}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU above 80%"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.id }
}
