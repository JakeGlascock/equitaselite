output "alb_dns_name" {
  description = "ALB DNS name — point your domain CNAME here"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID — for Route 53 alias records"
  value       = aws_lb.main.zone_id
}

output "ecr_repository_url" {
  description = "ECR repository URL for docker push"
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.app.name
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito App Client ID"
  value       = aws_cognito_user_pool_client.web.id
  sensitive   = false
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "rds_endpoint" {
  description = "RDS writer endpoint (private)"
  value       = aws_db_instance.main.address
  sensitive   = true
}

output "documents_bucket" {
  description = "Document vault S3 bucket name"
  value       = aws_s3_bucket.documents.id
}

output "kms_key_arns" {
  description = "KMS key ARNs by purpose"
  value = {
    rds     = aws_kms_key.rds.arn
    s3      = aws_kms_key.s3.arn
    logs    = aws_kms_key.logs.arn
    secrets = aws_kms_key.secrets.arn
  }
}

output "security_alerts_topic_arn" {
  description = "SNS topic ARN for security alerts — subscribe your on-call email here"
  value       = aws_sns_topic.security_alerts.arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN — add DNS validation records to GoDaddy to activate"
  value       = aws_acm_certificate.main.arn
}

output "route53_nameservers" {
  description = "Set these as Custom Nameservers at GoDaddy to move DNS to Route 53"
  value       = aws_route53_zone.main.name_servers
}

output "acm_validation_records" {
  description = "DNS CNAME records to add to GoDaddy to validate the ACM certificate"
  value = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}
