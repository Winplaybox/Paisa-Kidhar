#!/usr/bin/env bash
# Paisa Kidhar API on the Hostinger VPS (Docker, bound to 127.0.0.1 only; existing sites are not touched).
# Needs: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, DOMAIN; optional LEGACY_SUPABASE_URL. Source: ./apps/api or $PAISA_BUNDLE (tar.gz).
set -euo pipefail
: "${DATABASE_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_ANON_KEY:?}" "${DOMAIN:?}"
BASE=/opt/paisa-api; NAME=paisa-api; mkdir -p "$BASE"; cd "$BASE"
log(){ printf '\n== %s\n' "$*"; }

log "Docker"
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; }
systemctl enable --now docker >/dev/null 2>&1 || true

log "Source"
rm -rf src && mkdir src
if [ -n "${PAISA_BUNDLE:-}" ] && [ -f "$PAISA_BUNDLE" ]; then tar xzf "$PAISA_BUNDLE" -C src; else cp -r "$(dirname "$0")/../../apps/api/." src/; fi

log ".env (kept if it already exists, so secrets stay stable across re-runs)"
if [ ! -f .env ]; then
  umask 077
  cat > .env <<ENV
ENVIRONMENT=production
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_JWT_SECRET=
LEGACY_SUPABASE_URL=${LEGACY_SUPABASE_URL:-}
DATABASE_URL=$DATABASE_URL
PLEDGE_TOKEN_SECRET=$(openssl rand -hex 32)
IP_HASH_SALT=$(openssl rand -hex 16)
TRUSTED_PROXY_HOPS=1
PUBLIC_WEB_URL=https://paisa.winplaybox.in
CORS_ORIGINS=https://paisa.winplaybox.in
APP_CHECK_MODE=monitor
PAYMENTS_ENABLED=false
DODO_PAYMENTS_ENVIRONMENT=test_mode
CHECKOUT_RETURN_URL=https://paisa.winplaybox.in/billing/return
ENV
fi
chmod 600 .env

log "Pick a free local port"
PORT=8100; while ss -ltn "sport = :$PORT" | grep -q LISTEN; do PORT=$((PORT+1)); done
echo "using 127.0.0.1:$PORT"

log "Build + run"
docker build -t "$NAME" src
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped -p "127.0.0.1:$PORT:8000" --env-file .env --memory 512m "$NAME" >/dev/null
for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && { echo "API healthy"; break; }; sleep 2; [ "$i" = 30 ] && { docker logs --tail 50 "$NAME"; echo "API did not become healthy"; exit 1; }; done

log "HTTPS in front of it ($DOMAIN)"
if systemctl is-active --quiet caddy 2>/dev/null; then
  CF=/etc/caddy/Caddyfile; cp "$CF" "$CF.bak.$(date +%s)"
  grep -q "^$DOMAIN" "$CF" || printf '\n%s {\n\treverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$PORT" >> "$CF"
  caddy validate --config "$CF" && systemctl reload caddy && echo "Caddy: added $DOMAIN"
elif systemctl is-active --quiet nginx 2>/dev/null; then
  SA=/etc/nginx/sites-available/$DOMAIN
  cat > "$SA" <<NG
server {
  listen 80; listen [::]:80; server_name $DOMAIN;
  location / { proxy_pass http://127.0.0.1:$PORT; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; proxy_set_header X-Forwarded-Proto \$scheme; }
}
NG
  ln -sf "$SA" /etc/nginx/sites-enabled/$DOMAIN
  nginx -t && systemctl reload nginx
  command -v certbot >/dev/null || apt-get install -y -qq certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m support@winplaybox.in --redirect && echo "nginx: HTTPS ready for $DOMAIN"
elif ss -ltn 'sport = :80 or sport = :443' | grep -q LISTEN; then
  echo "Something else already owns ports 80/443 (not Caddy/nginx). Left untouched. Listeners:"; ss -ltnp 'sport = :80 or sport = :443'
  echo "Point that proxy at 127.0.0.1:$PORT for $DOMAIN."
else
  apt-get install -y -qq caddy
  printf '%s {\n\treverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$PORT" > /etc/caddy/Caddyfile
  systemctl enable --now caddy && systemctl reload caddy && echo "Caddy installed for $DOMAIN"
fi

log "Check"
sleep 5; curl -fsS "https://$DOMAIN/healthz" && echo " <- public HTTPS OK" || echo "Public HTTPS not ready yet (DNS/cert can take a few minutes). Local API is healthy on 127.0.0.1:$PORT."
