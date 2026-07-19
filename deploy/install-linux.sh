#!/usr/bin/env bash
# ============================================================================
# MOTP 원클릭 서버 설치기 (Linux / Debian·Ubuntu 계열, apt 기반)
#
# 이 스크립트가 하는 일:
#   1. Node.js, nginx, certbot 설치 (이미 있으면 건너뜀)
#   2. 앱 의존성 설치 + 클라이언트 프로덕션 빌드
#   3. Node 서버를 systemd 서비스로 등록해 상시 구동(재부팅/장애 시 자동 재시작)
#   4. nginx를 리버스 프록시로 앞단에 두고, certbot으로 Let's Encrypt SSL 인증서를
#      자동 발급 + 자동 갱신 설정까지 완료
#
# 사전 준비물(스크립트가 대신할 수 없는 것):
#   - 실제 공인 IP를 가진 리눅스 서버(VPS 등)
#   - 도메인의 A 레코드가 이 서버의 공인 IP를 가리키도록 DNS 설정 완료
#   - 80/443 포트가 방화벽/보안그룹에서 외부에 열려 있을 것
#
# 사용법:
#   sudo ./deploy/install-linux.sh --domain game.example.com --email you@example.com
#   (인자를 안 주면 대화형으로 물어봅니다)
# ============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[오류] root 권한이 필요합니다. sudo로 다시 실행하세요: sudo $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_USER="${SUDO_USER:-root}"
PORT="${PORT:-5000}"

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$DOMAIN" ]; then
  read -rp "도메인을 입력하세요 (예: game.example.com): " DOMAIN
fi
if [ -z "$EMAIL" ]; then
  read -rp "Let's Encrypt 알림용 이메일을 입력하세요: " EMAIL
fi
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "[오류] 도메인과 이메일은 필수입니다." >&2
  exit 1
fi

echo "===================================================="
echo "  MOTP 서버 설치 — 도메인: $DOMAIN / 포트: $PORT"
echo "  설치 경로: $REPO_ROOT"
echo "===================================================="

# ---- 1) Node.js -------------------------------------------------------------
# fnm/nvm으로 이미 설치돼 있는 경우를 apt/NodeSource 중복 설치로 오인하지 않도록 주의한다.
# 이들은 보통 ~/.bashrc에 초기화 코드를 넣어두는데, sudo나 비대화형 셸은 그걸 읽지
# 않아서 `command -v node`가 실패하기 쉽다 — 실제 실행 사용자($RUN_USER)의 로그인
# 셸을 대화형으로 흉내내 한 번 더 찾아본 뒤에만 새로 설치한다.
detect_existing_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  local found
  found="$(sudo -u "$RUN_USER" -i bash -ic 'command -v node' 2>/dev/null | tail -n1 || true)"
  if [ -n "$found" ] && [ -x "$found" ]; then
    printf '%s\n' "$found"
    return 0
  fi
  return 1
}

if EXISTING_NODE="$(detect_existing_node)"; then
  echo "[확인] 기존 Node.js 설치 발견 ($RUN_USER 사용자): $EXISTING_NODE ($("$EXISTING_NODE" -v))"
  NODE_BIN="$EXISTING_NODE"
else
  echo "[설치] Node.js 24.x (NodeSource) — 기존 설치(nvm/fnm 포함)를 찾지 못해 새로 설치합니다..."
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
  NODE_BIN="$(command -v node)"
fi
NODE_DIR="$(dirname "$NODE_BIN")"
NPM_BIN="$NODE_DIR/npm"

# ---- 2) nginx / certbot ------------------------------------------------------
echo "[설치] nginx, certbot..."
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

# ---- 3) 앱 빌드 --------------------------------------------------------------
# nvm/fnm으로 설치된 node/npm은 시스템 PATH에 없을 수 있으므로, 감지된 경로를
# 직접 지정해 실행한다(사용자의 .bashrc를 다시 소싱할 필요가 없다).
echo "[빌드] 의존성 설치 및 클라이언트 빌드... (node: $NODE_BIN)"
cd "$REPO_ROOT"
sudo -u "$RUN_USER" env "PATH=$NODE_DIR:$PATH" "$NPM_BIN" install
sudo -u "$RUN_USER" env "PATH=$NODE_DIR:$PATH" "$NPM_BIN" run build:client

# ---- 4) systemd 서비스 --------------------------------------------------------
echo "[서비스] systemd 유닛 작성..."
cat > /etc/systemd/system/motp.service <<EOF
[Unit]
Description=Memories of the Past - TIMES Nightmare server
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO_ROOT
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=NO_BROWSER=1
Environment=PATH=$NODE_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=$NODE_BIN $REPO_ROOT/server/src/index.js
Restart=on-failure
RestartSec=3
User=$RUN_USER

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now motp

# ---- 5) nginx 사이트 설정 ------------------------------------------------------
echo "[nginx] 사이트 설정 작성..."
NGINX_SITE="/etc/nginx/sites-available/motp"
cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

mkdir -p /etc/nginx/sites-enabled
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/motp
# 기본 데모 사이트가 같은 80번 포트를 잡고 있으면 충돌하므로 비활성화
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx || systemctl restart nginx

# ---- 6) 방화벽(ufw가 있는 경우) -------------------------------------------------
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "[방화벽] ufw에 Nginx Full(80/443) 허용..."
  ufw allow 'Nginx Full' || true
fi

# ---- 7) SSL 인증서 (certbot이 nginx 설정을 알아서 443 블록으로 확장) -------------------
echo "[SSL] certbot으로 Let's Encrypt 인증서 발급..."
certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --redirect --non-interactive

echo
echo "===================================================="
echo "  설치 완료!  https://$DOMAIN"
echo "  - Node 서버 상태: systemctl status motp"
echo "  - nginx 상태:     systemctl status nginx"
echo "  - 인증서 자동 갱신: certbot이 설치한 systemd 타이머(certbot.timer)가 처리합니다"
echo "  - 재배포 시: 코드 수정 후 다시 이 스크립트를 실행하면 됩니다(재실행 안전)"
echo "===================================================="
