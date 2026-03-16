# SSL Certificates

Place your SSL certificate files here:

```
nginx/ssl/
├── fullchain.pem   ← Full certificate chain (cert + intermediates)
└── privkey.pem     ← Private key
```

## Getting a free certificate with Let's Encrypt (recommended)

On the Windows server, run via **WSL2** or a Linux VM:

```bash
# Install certbot
sudo apt install certbot

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone \
  -d leesrca.kmgvitallinks.com \
  --email admin@kmgvitallinks.com \
  --agree-tos --no-eff-email

# Copy to this folder
sudo cp /etc/letsencrypt/live/leesrca.kmgvitallinks.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/leesrca.kmgvitallinks.com/privkey.pem   ./nginx/ssl/
sudo chmod 644 ./nginx/ssl/*.pem
```

## Auto-renewal (cron)

Add to crontab (`crontab -e`):
```
0 3 * * * certbot renew --quiet && docker compose -f /path/to/project/docker-compose.yml restart nginx
```

## DNS Setup

Point `leesrca.kmgvitallinks.com` → `100.42.189.186` via an A record in your DNS panel.
