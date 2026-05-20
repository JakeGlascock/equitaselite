variable "aws_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Environment must be staging or prod."
  }
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "equitaselite"
}

variable "domain_name" {
  description = "Primary domain"
  type        = string
  default     = "equitaselite.com"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "equitaselite"
}

variable "ecs_cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 512
}

variable "ecs_memory" {
  description = "ECS task memory (MB)"
  type        = number
  default     = 1024
}

variable "app_min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 2
}

variable "app_max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 10
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "retention_days" {
  description = "CloudWatch log and CloudTrail retention in days"
  type        = number
  default     = 365
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "equitaselite_admin"
}

variable "admin_emails" {
  description = "Comma-separated emails granted access to /admin"
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repo in 'owner/name' format authorized to deploy via OIDC"
  type        = string
  default     = "JakeGlascock/equitaselite"
}

# ── iOS native push (Phase M2) + Universal Links (Phase M3) ─────────
# These are all safely-empty by default so a fresh apply works without
# Apple Developer setup. Fill in once the APNs key is uploaded and the
# SNS Platform Application is created.
variable "push_provider" {
  description = "Push transport: '' / 'stub' (log-only, default) or 'sns' (AWS SNS Mobile Push)"
  type        = string
  default     = ""
}

variable "apns_platform_app_arn" {
  description = "ARN of the SNS Platform Application created from the APNs .p8 key. Empty disables SNS dispatch."
  type        = string
  default     = ""
}

variable "apple_team_id" {
  description = "Apple Developer Team ID. Composed with the iOS bundle id in the AASA file to activate Universal Links."
  type        = string
  default     = ""
}
