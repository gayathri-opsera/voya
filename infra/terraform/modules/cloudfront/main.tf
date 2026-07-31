# WO-080: CloudFront distribution, WAF, and TLS-terminating ALB.

variable "environment" { type = string }
variable "alb_dns_name" { type = string }
variable "certificate_arn" { type = string }
variable "domain_name" { type = string }
variable "waf_acl_arn" { type = string default = "" }

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.environment} Travel Platform CDN"
  aliases             = [var.domain_name]
  default_root_object = ""
  price_class         = "PriceClass_100"  # US + Europe

  # Restrict direct ALB access — only CloudFront can call ALB
  custom_header {
    name  = "X-Origin-Verify"
    value = "travel-${var.environment}-secret"
  }

  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "X-Correlation-ID", "X-Request-ID", "Origin"]
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 0   # API — no caching by default
    max_ttl     = 0
  }

  # Cache static assets for 1 year
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 86400
    default_ttl = 604800
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Attach WAF if provided
  dynamic "web_acl_id" { for_each = var.waf_acl_arn != "" ? [var.waf_acl_arn] : [] }

  logging_config {
    bucket          = "travel-${var.environment}-cf-logs.s3.amazonaws.com"
    include_cookies = false
    prefix          = "cloudfront/"
  }
}

output "distribution_id" { value = aws_cloudfront_distribution.main.id }
output "domain_name"      { value = aws_cloudfront_distribution.main.domain_name }
