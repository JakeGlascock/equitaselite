terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — create this S3 bucket manually before first init
  backend "s3" {
    bucket         = "equitaselite-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "alias/terraform-state"
    dynamodb_table = "equitaselite-terraform-locks"
    # Use FIPS endpoint for state backend
    endpoint = "https://s3-fips.us-east-1.amazonaws.com"
  }
}

provider "aws" {
  region = var.aws_region

  # Force FIPS-validated endpoints globally
  use_fips_endpoint = true

  default_tags {
    tags = {
      Project     = "equitaselite"
      Environment = var.environment
      ManagedBy   = "terraform"
      Compliance  = "fips-140-2"
    }
  }
}

# Secondary provider for CloudFront (must be us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  use_fips_endpoint = true
}
