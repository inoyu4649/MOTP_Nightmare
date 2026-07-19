#!/usr/bin/env bash
# MOTP 서버 제거 (Linux) — install-linux.sh가 만든 것들을 되돌린다.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[오류] root 권한이 필요합니다: sudo $0" >&2
  exit 1
fi

echo "[제거] motp systemd 서비스 중지/비활성화..."
systemctl stop motp 2>/dev/null || true
systemctl disable motp 2>/dev/null || true
rm -f /etc/systemd/system/motp.service
systemctl daemon-reload

echo "[제거] nginx 사이트 설정 제거..."
rm -f /etc/nginx/sites-enabled/motp /etc/nginx/sites-available/motp
nginx -t 2>/dev/null && systemctl reload nginx || true

read -rp "발급된 SSL 인증서도 삭제할까요? 도메인을 입력(건너뛰려면 Enter): " DOMAIN
if [ -n "${DOMAIN:-}" ]; then
  certbot delete --cert-name "$DOMAIN" --non-interactive || true
fi

echo "완료. nginx/certbot/Node.js 자체(apt 패키지)는 제거하지 않았습니다 — 필요하면"
echo "  apt-get remove nginx certbot python3-certbot-nginx nodejs"
echo "로 직접 제거하세요."
