# Hermes runtime module (Phase 4) — apply only with GCP credentials.
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }
}

variable "project_id" { type = string }
variable "region" { type = string }
variable "zone" { type = string }
variable "name" { type = string }
variable "machine_type" {
  type    = string
  default = "e2-medium"
}
variable "disk_size_gb" {
  type    = number
  default = 40
}

resource "google_service_account" "hermes" {
  account_id   = "${var.name}-sa"
  display_name = "Certo Hermes Runtime"
  project      = var.project_id
}

resource "google_compute_disk" "hermes_data" {
  name    = "${var.name}-data"
  type    = "pd-balanced"
  zone    = var.zone
  size    = var.disk_size_gb
  project = var.project_id
}

resource "google_compute_instance" "hermes" {
  name         = var.name
  machine_type = var.machine_type
  zone         = var.zone
  project      = var.project_id

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 20
    }
  }

  attached_disk {
    source = google_compute_disk.hermes_data.id
  }

  network_interface {
    network = "default"
    # No public Hermes port. Prefer IAP / Cloudflare Tunnel.
  }

  service_account {
    email  = google_service_account.hermes.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = <<-EOT
    #!/bin/bash
    set -euo pipefail
    apt-get update
    apt-get install -y docker.io docker-compose-v2
    mkdir -p /opt/data
    # Attach + mount persistent disk if present (device name may vary)
    if ! mountpoint -q /opt/data; then
      DISK=$(lsblk -o NAME,TYPE -dsn | awk '$2=="disk"{print $1}' | tail -n1 || true)
      if [ -n "$${DISK}" ]; then
        mkfs.ext4 -F /dev/$${DISK} || true
        mount /dev/$${DISK} /opt/data || true
      fi
    fi
    systemctl enable --now docker
    echo "Certo Hermes bootstrap complete. Deploy compose via CI/SSH."
  EOT

  tags = ["certo-hermes-runtime"]
}

output "instance_name" { value = google_compute_instance.hermes.name }
output "service_account" { value = google_service_account.hermes.email }
output "data_disk" { value = google_compute_disk.hermes_data.name }
