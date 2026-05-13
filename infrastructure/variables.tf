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
