#!/bin/bash
# Run once on a fresh Amazon Linux 2023 instance

set -e

echo ">>> Installing Node.js 22..."
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

echo ">>> Installing PM2..."
sudo npm install -g pm2

echo ">>> Installing Nginx..."
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

echo ">>> Cloning repo..."
cd /home/ec2-user
git clone https://github.com/deeptrck/Gotham-Enterprise.git
cd Gotham-Enterprise
npm install
npm run build

echo ">>> Setting up PM2..."
pm2 start /home/ec2-user/Gotham-Enterprise/infra/pm2/ecosystem.config.js
pm2 save
pm2 startup

echo ">>> Copying Nginx config..."
sudo cp infra/nginx/gotham.conf /etc/nginx/conf.d/gotham.conf
sudo nginx -t && sudo systemctl reload nginx

echo ">>> Run SSL setup manually:"
echo "sudo certbot --nginx -d
@'
# Gotham Infrastructure

## Server
- AWS EC2 Amazon Linux 2023
- Instance: i-064908184cf2965c8
- Elastic IP: 54.85.165.14
- Domain: gotham.deeptrack.io

## Stack
- Next.js 15 standalone via PM2
- Nginx reverse proxy
- SSL via Certbot (Let's Encrypt)
- Node.js 18.20.8 (upgrade to 22 pending)

## Deploy
```bash
ssh -i ~/.ssh/gotham-key.pem ec2-user@54.85.165.14
bash /home/ec2-user/Gotham-Enterprise/infra/scripts/deploy.sh
```

## Fresh server setup
```bash
bash infra/scripts/setup-ec2.sh
```
