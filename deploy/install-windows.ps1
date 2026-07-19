<#
============================================================================
 MOTP 원클릭 서버 설치기 (Windows Server / Windows 10·11)

 이 스크립트가 하는 일:
   1. Node.js 확인/설치(winget), nginx 다운로드/설치, win-acme(ACME 클라이언트) 다운로드
   2. 앱 의존성 설치 + 클라이언트 프로덕션 빌드
   3. Node 서버 + nginx를 "시작 시 자동 실행" 예약 작업(Scheduled Task)으로 등록
      (SYSTEM 계정, 로그인 여부와 무관하게 상시 구동 — 별도 서비스 래퍼 없이 Windows 내장
      기능만 사용)
   4. nginx를 리버스 프록시로 앞단에 두고, win-acme로 Let's Encrypt SSL 인증서를 발급받아
      443 포트에 연결(HTTP 검증용 1단계 설정 → 인증서 발급 → 443 블록 추가 2단계 설정)

 사전 준비물(스크립트가 대신할 수 없는 것):
   - 실제 공인 IP를 가진 Windows 서버
   - 도메인의 A 레코드가 이 서버의 공인 IP를 가리키도록 DNS 설정 완료
   - 80/443 포트가 방화벽/보안그룹에서 외부에 열려 있을 것
   - 관리자 권한 PowerShell에서 실행

 사용법 (관리자 PowerShell):
   .\deploy\install-windows.ps1 -Domain game.example.com -Email you@example.com

 주의: win-acme 자동 발급 단계는 실제 공인 도메인+80포트 환경에서만 동작 검증이
 가능해, 이 저장소 안에서 실행 테스트를 하지 못했습니다. 해당 단계가 실패하면
 스크립트가 안내하는 대로 C:\win-acme\wacs.exe 를 대화형으로 직접 실행해도 됩니다
 (win-acme 정식 사용법이며 메뉴로 전부 안내됩니다).
============================================================================
#>

param(
    [string]$Domain,
    [string]$Email,
    [int]$Port = 5000
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
        Write-Error "관리자 권한 PowerShell에서 실행하세요 (Run as Administrator)."
        exit 1
    }
}
Assert-Admin

if (-not $Domain) { $Domain = Read-Host "도메인을 입력하세요 (예: game.example.com)" }
if (-not $Email) { $Email = Read-Host "Let's Encrypt 알림용 이메일을 입력하세요" }
if (-not $Domain -or -not $Email) {
    Write-Error "도메인과 이메일은 필수입니다."
    exit 1
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$NginxRoot = 'C:\nginx'
$WinAcmeRoot = 'C:\win-acme'
$SslDir = "$NginxRoot\ssl"

Write-Host "===================================================="
Write-Host "  MOTP 서버 설치 — 도메인: $Domain / 포트: $Port"
Write-Host "  앱 경로: $RepoRoot"
Write-Host "===================================================="

# ---- 1) Node.js -------------------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[설치] Node.js (winget)..."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    } else {
        Write-Error "winget을 찾을 수 없습니다. https://nodejs.org 에서 Node.js LTS를 직접 설치한 뒤 다시 실행하세요."
        exit 1
    }
} else {
    Write-Host "[확인] Node.js $(node -v) 이미 설치됨"
}

# ---- 2) nginx 다운로드 --------------------------------------------------------
if (-not (Test-Path "$NginxRoot\nginx.exe")) {
    Write-Host "[설치] nginx 다운로드 (nginx.org 공식 배포본)..."
    $downloadPage = Invoke-WebRequest -Uri 'https://nginx.org/en/download.html' -UseBasicParsing
    if ($downloadPage.Content -match 'nginx-([\d.]+)\.zip') {
        $nginxVersion = $Matches[1]
    } else {
        throw "nginx.org에서 최신 버전을 찾지 못했습니다. https://nginx.org/en/download.html 에서 zip을 수동으로 받아 C:\nginx 에 압축 해제하세요."
    }
    $zipUrl = "https://nginx.org/download/nginx-$nginxVersion.zip"
    $tmpZip = "$env:TEMP\nginx-$nginxVersion.zip"
    $tmpExtract = "$env:TEMP\nginx-extract"
    Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip
    if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }
    Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract
    Move-Item "$tmpExtract\nginx-$nginxVersion" $NginxRoot
    Remove-Item $tmpZip -Force
    Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "[확인] nginx 이미 설치됨: $NginxRoot"
}
New-Item -ItemType Directory -Force -Path $SslDir | Out-Null

# ---- 3) win-acme 다운로드 (GitHub 공식 릴리스) ---------------------------------
if (-not (Test-Path "$WinAcmeRoot\wacs.exe")) {
    Write-Host "[설치] win-acme 다운로드 (GitHub 공식 릴리스)..."
    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/win-acme/win-acme/releases/latest'
    $asset = $release.assets | Where-Object { $_.name -match 'win-acme.*x64.*trimmed.*\.zip$' } | Select-Object -First 1
    if (-not $asset) { $asset = $release.assets | Where-Object { $_.name -match '\.zip$' } | Select-Object -First 1 }
    if (-not $asset) { throw "win-acme 릴리스 자산을 찾지 못했습니다. https://github.com/win-acme/win-acme/releases 에서 수동으로 받아 C:\win-acme 에 압축 해제하세요." }
    $tmpZip = "$env:TEMP\win-acme.zip"
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmpZip
    New-Item -ItemType Directory -Force -Path $WinAcmeRoot | Out-Null
    Expand-Archive -Path $tmpZip -DestinationPath $WinAcmeRoot -Force
    Remove-Item $tmpZip -Force
} else {
    Write-Host "[확인] win-acme 이미 설치됨: $WinAcmeRoot"
}

# ---- 4) 앱 빌드 --------------------------------------------------------------
Write-Host "[빌드] 의존성 설치 및 클라이언트 빌드..."
Push-Location $RepoRoot
& npm.cmd install
& npm.cmd run build:client
Pop-Location

# ---- 5) 환경변수(SYSTEM이 실행할 Node 프로세스용, 머신 전역) ------------------------
[Environment]::SetEnvironmentVariable('PORT', "$Port", 'Machine')
[Environment]::SetEnvironmentVariable('NODE_ENV', 'production', 'Machine')
[Environment]::SetEnvironmentVariable('NO_BROWSER', '1', 'Machine')

# ---- 6) nginx 1단계 설정(HTTP + ACME 검증 경로만) --------------------------------
Write-Host "[nginx] 1단계 설정(HTTP) 작성..."
$nginxConfPhase1 = @"
worker_processes  1;
events { worker_connections  1024; }
http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    server {
        listen 80;
        server_name $Domain;

        location /.well-known/acme-challenge/ {
            root $($NginxRoot -replace '\\','/')/html;
        }

        location / {
            proxy_pass http://127.0.0.1:$Port;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }
    }
}
"@
Set-Content -Path "$NginxRoot\conf\nginx.conf" -Value $nginxConfPhase1 -Encoding ascii

# ---- 7) Node 서버 + nginx를 시작 프로그램(예약 작업)으로 등록 -------------------------
Write-Host "[작업 스케줄러] MOTP-Server, MOTP-Nginx 등록..."
$nodePath = (Get-Command node).Source

$serverAction = New-ScheduledTaskAction -Execute $nodePath -Argument 'server\src\index.js' -WorkingDirectory $RepoRoot
$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$systemPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$restartSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName 'MOTP-Server' -Action $serverAction -Trigger $startupTrigger `
    -Principal $systemPrincipal -Settings $restartSettings -Force | Out-Null

$nginxAction = New-ScheduledTaskAction -Execute "$NginxRoot\nginx.exe" -WorkingDirectory $NginxRoot
Register-ScheduledTask -TaskName 'MOTP-Nginx' -Action $nginxAction -Trigger $startupTrigger `
    -Principal $systemPrincipal -Settings $restartSettings -Force | Out-Null

# 재실행 시 기존 프로세스가 떠 있으면 정리 후 재기동
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $nodePath -and $_.MainWindowTitle -eq '' } | Stop-Process -Force -ErrorAction SilentlyContinue
& "$NginxRoot\nginx.exe" -s stop 2>$null
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName 'MOTP-Server'
Start-ScheduledTask -TaskName 'MOTP-Nginx'

# ---- 8) 방화벽 -------------------------------------------------------------
foreach ($rule in @(
    @{ Name = 'MOTP HTTP'; Port = 80 },
    @{ Name = 'MOTP HTTPS'; Port = 443 }
)) {
    if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP -LocalPort $rule.Port -Action Allow | Out-Null
    }
}

# ---- 9) SSL 인증서 발급 (win-acme) -------------------------------------------
Write-Host "[SSL] win-acme로 Let's Encrypt 인증서 발급 시도..."
Start-Sleep -Seconds 2  # nginx가 80포트 바인딩할 시간을 잠깐 준다

$reloadScript = "$NginxRoot\reload-nginx.bat"
Set-Content -Path $reloadScript -Value "@echo off`r`n`"$NginxRoot\nginx.exe`" -s reload`r`n" -Encoding ascii

$wacsArgs = @(
    '--source', 'manual',
    '--host', $Domain,
    '--validation', 'filesystem',
    '--webroot', "$NginxRoot\html",
    '--store', 'pemfiles',
    '--pemfilespath', $SslDir,
    '--friendlyname', $Domain,
    '--installation', 'script',
    '--script', $reloadScript,
    '--accepttos',
    '--emailaddress', $Email,
    '--closeonfinish'
)

$wacsSucceeded = $false
try {
    & "$WinAcmeRoot\wacs.exe" @wacsArgs
    if (Test-Path "$SslDir\$Domain-chain.pem" -PathType Leaf) { $wacsSucceeded = $true }
} catch {
    Write-Warning "win-acme 자동 실행 중 오류: $_"
}

if ($wacsSucceeded) {
    Write-Host "[SSL] 인증서 발급 완료. nginx 2단계 설정(HTTPS) 적용..."
    $nginxConfPhase2 = @"
worker_processes  1;
events { worker_connections  1024; }
http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    server {
        listen 80;
        server_name $Domain;
        location /.well-known/acme-challenge/ {
            root $($NginxRoot -replace '\\','/')/html;
        }
        location / {
            return 301 https://`$host`$request_uri;
        }
    }

    server {
        listen 443 ssl;
        server_name $Domain;

        ssl_certificate      $($SslDir -replace '\\','/')/$Domain-chain.pem;
        ssl_certificate_key  $($SslDir -replace '\\','/')/$Domain-key.pem;

        location / {
            proxy_pass http://127.0.0.1:$Port;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }
    }
}
"@
    Set-Content -Path "$NginxRoot\conf\nginx.conf" -Value $nginxConfPhase2 -Encoding ascii
    & "$NginxRoot\nginx.exe" -t
    & "$NginxRoot\nginx.exe" -s reload
    Write-Host "===================================================="
    Write-Host "  설치 완료!  https://$Domain"
} else {
    Write-Warning @"
win-acme 자동 발급이 완료되지 않았습니다(스크립트로 직접 검증하지 못한 단계입니다).
다음을 직접 실행해 대화형으로 인증서를 발급하세요:

    cd $WinAcmeRoot
    .\wacs.exe

메뉴에서 "Create certificate (default settings)" 선택 후 도메인을 입력하면 됩니다.
발급된 인증서 경로를 nginx.conf 의 443 server 블록에 연결한 뒤 nginx를 reload 하세요
(예시는 이 스크립트의 `$nginxConfPhase2` 부분 참고).
지금은 HTTP(80)로만 서비스되고 있습니다: http://$Domain
"@
}

Write-Host "  - Node 서버: Get-ScheduledTask -TaskName MOTP-Server"
Write-Host "  - nginx:     Get-ScheduledTask -TaskName MOTP-Nginx"
Write-Host "  - win-acme는 첫 발급 성공 시 자체적으로 갱신용 예약 작업을 등록합니다"
Write-Host "===================================================="
