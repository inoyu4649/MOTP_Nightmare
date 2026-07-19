#!/usr/bin/env bash
# ============================================================================
# MOTP 배포 업데이트 (Linux) — install-linux.sh로 이미 설치된 서버에서, 코드
# 변경분을 반영할 때만 빠르게 돌리는 스크립트입니다. nginx/certbot/systemd
# 유닛은 건드리지 않고, 재빌드 + 서비스 재시작만 합니다.
#
# 사용법:
#   sudo ./deploy/update-linux.sh
# ============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[오류] root 권한이 필요합니다. sudo로 다시 실행하세요: sudo $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_USER="${SUDO_USER:-root}"

cd "$REPO_ROOT"

if [ -d .git ]; then
  echo "[갱신] git pull..."
  sudo -u "$RUN_USER" git pull
else
  echo "[건너뜀] git 저장소가 아닙니다 — 코드는 이미 최신이라고 가정합니다."
fi

# install-linux.sh와 동일한 방식으로 Node를 찾는다(nvm/fnm으로 설치된 경우 포함).
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

if ! NODE_BIN="$(detect_existing_node)"; then
  echo "[오류] Node.js를 찾을 수 없습니다. 먼저 install-linux.sh를 실행하세요." >&2
  exit 1
fi
NODE_DIR="$(dirname "$NODE_BIN")"
NPM_BIN="$NODE_DIR/npm"

echo "[빌드] 의존성 설치 및 클라이언트 재빌드... (node: $NODE_BIN)"
sudo -u "$RUN_USER" env "PATH=$NODE_DIR:$PATH" "$NPM_BIN" install
sudo -u "$RUN_USER" env "PATH=$NODE_DIR:$PATH" "$NPM_BIN" run build:client

echo "[재시작] motp 서비스..."
systemctl restart motp

echo
echo "===================================================="
echo "  업데이트 완료!"
echo "  - 서버 상태: systemctl status motp"
echo "  - 로그:      journalctl -u motp -f"
echo "===================================================="
