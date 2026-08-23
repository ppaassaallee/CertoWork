# Staging Hermes runtime — NOT applied in CI without credentials.
terraform {
  required_version = ">= 1.5.0"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type    = string
  default = "gen-lang-client-0277783597"
}
variable "region" {
  type    = string
  default = "us-central1"
}
variable "zone" {
  type    = string
  default = "us-central1-a"
}

module "hermes" {
  source       = "../../modules/hermes-runtime"
  project_id   = var.project_id
  region       = var.region
  zone         = var.zone
  name         = "certo-hermes-staging"
  machine_type = "e2-medium"
  disk_size_gb = 40
}

output "instance_name" { value = module.hermes.instance_name }
output "service_account" { value = module.hermes.service_account }
