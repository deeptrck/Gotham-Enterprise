#!/bin/bash
set -e

echo ">>> Pulling latest code..."
cd /home/ec2-user/Gotham-Enterprise
git pull origin main

echo ">>> Installing dependencies..."
npm install

echo ">>> Building..."
npm run build

echo ">>> Restarting app..."
pm2 restart gotham-enterprise

echo ">>> Done. Gotham is live."
