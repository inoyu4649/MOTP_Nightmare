# MOTP 서버 배포

`start.bat` / `start.sh` (저장소 루트)는 **로컬 1회성 실행**용입니다 (부스 키오스크처럼
그 자리에서 브라우저 열고 창 닫으면 끝). 여기 `deploy/` 스크립트는 그것과 달리,
**도메인 + SSL을 갖춘 상시 운영 서버**로 배포하기 위한 것입니다.

## 아키텍처

```
사용자 → https://도메인 (nginx, 443/80) → 127.0.0.1:5000 (Node/Express, 항상 실행)
```

- Node/Express 서버(`server/src/index.js`)는 빌드된 클라이언트 정적 파일과 `/api/verify`를
  127.0.0.1:5000(외부 비공개)에서 서비스합니다.
- nginx가 도메인의 80/443을 받아 그 뒤로 리버스 프록시합니다.
- SSL은 Let's Encrypt 무료 인증서를 자동 발급/갱신합니다.

## 사전 준비 (스크립트가 대신할 수 없는 것)

1. 공인 IP가 있는 서버(VPS 등) — Linux(Ubuntu/Debian) 또는 Windows Server.
2. 도메인의 **A 레코드**가 그 서버의 공인 IP를 가리키도록 DNS 설정 완료.
3. 클라우드 방화벽/보안그룹에서 80, 443 포트를 외부에 열어둘 것.
4. 이 저장소 전체를 서버에 올려둘 것(git clone 또는 파일 복사).

## Linux (Ubuntu/Debian) — `install-linux.sh`

```bash
sudo ./deploy/install-linux.sh --domain game.example.com --email you@example.com
```

Node.js, nginx, certbot을 설치하고(이미 있으면 건너뜀), 앱을 빌드해 `motp` systemd
서비스로 등록하고, nginx 리버스 프록시 설정 후 `certbot --nginx`로 SSL까지 자동
발급합니다. **가장 검증된 표준 조합**(nginx + certbot)이라 재실행해도 안전합니다
(업데이트 배포 시 그냥 다시 실행하면 됩니다).

- 서버 로그/상태: `systemctl status motp`, `journalctl -u motp -f`
- 인증서 자동 갱신: certbot이 설치하는 `certbot.timer`가 자동 처리 (별도 설정 불필요)
- 제거: `sudo ./deploy/uninstall-linux.sh`

## Windows Server — `install-windows.ps1`

관리자 권한 PowerShell에서:

```powershell
.\deploy\install-windows.ps1 -Domain game.example.com -Email you@example.com
```

Node.js(winget), nginx(nginx.org 공식 zip), win-acme(GitHub 공식 릴리스)를 받아
`C:\nginx`, `C:\win-acme`에 설치하고, Node 서버 + nginx를 "시작 시 자동 실행"
예약 작업(Scheduled Task, SYSTEM 계정)으로 등록한 뒤 win-acme로 SSL 발급을
시도합니다.

**주의**: Windows는 nginx/ACID 서비스 관리 생태계가 Linux만큼 정형화되어 있지 않아,
win-acme 자동 발급 단계는 실제 공인 도메인 + 80포트 환경에서만 확인 가능한 부분이라
이 개발 환경에서는 실행 테스트를 하지 못했습니다. 스크립트 실행 후:

- 자동 발급이 성공하면 그대로 `https://도메인`으로 접속됩니다.
- 실패하면 스크립트가 안내 메시지를 띄웁니다 — `C:\win-acme\wacs.exe`를 대화형으로
  직접 실행(메뉴 기반, win-acme 정식 사용법)해 인증서를 발급받고, 안내된 대로
  `C:\nginx\conf\nginx.conf`의 443 블록에 인증서 경로를 연결한 뒤
  `C:\nginx\nginx.exe -s reload` 하면 됩니다. 그 사이에도 `http://도메인`으로는
  정상 서비스됩니다.
- win-acme는 첫 발급 성공 시 자체적으로 갱신용 예약 작업을 등록합니다.

상태 확인: `Get-ScheduledTask -TaskName MOTP-Server`, `Get-ScheduledTask -TaskName MOTP-Nginx`

제거: 관리자 PowerShell에서 `.\deploy\uninstall-windows.ps1`

## 배포 후 업데이트

코드를 수정한 뒤, 서버에서:

```bash
sudo ./deploy/update-linux.sh
```

```powershell
.\deploy\update-windows.ps1     # 관리자 PowerShell
```

`update-*` 스크립트는 (저장소가 git clone이면) `git pull` → `npm install` →
`npm run build:client` → 서비스 재시작만 빠르게 수행합니다. nginx/certbot/win-acme
설치나 systemd 유닛·예약 작업 등록은 건드리지 않습니다 — 도메인/포트를 바꾸거나
nginx 설정 자체를 다시 만들어야 할 때만 `install-linux.sh`/`install-windows.ps1`을
다시 실행하세요(재실행해도 안전).

**참고**: 여기 nginx 설정(`install-linux.sh`/`install-windows.ps1`이 생성하는 것)은
`proxy_cache` 등 캐싱 지시문을 전혀 쓰지 않는 단순 리버스 프록시라, nginx 자체가
응답을 캐싱해서 변경이 반영 안 되는 구조는 아닙니다. 배포했는데도 안 바뀐 것처럼
보인다면 대개 ①`build:client`를 다시 안 돌려서 `client/dist`가 예전 그대로거나
②브라우저가 예전 페이지를 캐시해서 보여주는 경우입니다 — `update-*` 스크립트로
재빌드한 뒤, 브라우저에서 강력 새로고침(Ctrl+Shift+R)까지 해보세요.

## 포트/도메인 바꾸기

`--port` (Linux) / `-Port` (Windows) 인자로 Node 서버 포트를 바꿀 수 있습니다
(기본 5000). 도메인을 바꾸려면 각 스크립트를 새 도메인으로 다시 실행하세요.

## 트러블슈팅

### certbot이 "Error getting validation data" / 인증 실패로 죽는 경우

```
Certbot failed to authenticate some domains (authenticator: nginx).
Detail: <IP>: Fetching http://도메인/.well-known/acme-challenge/...: Error getting validation data
```

이건 거의 항상 **Let's Encrypt 서버가 80번 포트로 아예 접속을 못 한 것**이지, nginx
설정 문제가 아닙니다. 확인 순서:

1. `sudo ss -tlnp | grep -E ':80|:443'` — nginx가 `0.0.0.0:80`에 LISTEN 중인지 확인.
   여기 잡히면 로컬 서비스는 정상이고, 문제는 그 앞단의 방화벽입니다.
2. **클라우드/호스팅 콘솔의 보안그룹(Security Group / ACG) 확인** — 실제로 겪었던
   원인. VPS 업체 콘솔에는 SSH(22)만 기본으로 열려 있고 80/443은 별도로 추가해야
   하는 경우가 많습니다. OS 방화벽(ufw)이 아니라 콘솔에서 인바운드 TCP 80, 443을
   `0.0.0.0/0`으로 열어줘야 합니다. (`sudo ufw status`가 `inactive`면 OS 방화벽은
   원인이 아니라는 뜻 — 그럼 십중팔구 콘솔 쪽 보안그룹입니다.)
3. 보안그룹에서 포트를 연 뒤, `install-linux.sh`를 처음부터 다시 돌릴 필요 없이
   certbot만 다시 실행하면 됩니다:
   ```bash
   sudo certbot --nginx -d 도메인 -m 이메일 --agree-tos --redirect
   ```

**진단 팁**: SSH(22)는 접속되는데 80/443만 타임아웃(연결 거부가 아니라 응답 자체가
없음)이면 방화벽이 패킷을 조용히 버리고 있다는 신호입니다 — 서버가 죽은 게
아니라 그 앞단 어딘가(클라우드 보안그룹일 확률이 가장 높음)에서 막혔다는 뜻입니다.
