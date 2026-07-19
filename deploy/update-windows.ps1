<#
============================================================================
 MOTP 배포 업데이트 (Windows) — install-windows.ps1로 이미 설치된 서버에서,
 코드 변경분을 반영할 때만 빠르게 돌리는 스크립트입니다. nginx/win-acme 설치나
 예약 작업 등록은 건드리지 않고, 재빌드 + Node 서버 재시작만 합니다.

 사용법 (관리자 PowerShell):
   .\deploy\update-windows.ps1
============================================================================
#>

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

$RepoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "===================================================="
Write-Host "  MOTP 배포 업데이트 — 경로: $RepoRoot"
Write-Host "===================================================="

Push-Location $RepoRoot
try {
    if (Test-Path (Join-Path $RepoRoot '.git')) {
        Write-Host "[갱신] git pull..."
        & git pull
    } else {
        Write-Host "[건너뜀] git 저장소가 아닙니다 — 코드는 이미 최신이라고 가정합니다."
    }

    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        throw "Node.js를 찾을 수 없습니다. 먼저 install-windows.ps1을 실행하세요."
    }

    Write-Host "[빌드] 의존성 설치 및 클라이언트 재빌드..."
    & npm.cmd install
    & npm.cmd run build:client
} finally {
    Pop-Location
}

$task = Get-ScheduledTask -TaskName 'MOTP-Server' -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Warning "MOTP-Server 예약 작업을 찾지 못했습니다. install-windows.ps1을 먼저 실행했는지 확인하세요."
} else {
    Write-Host "[재시작] MOTP-Server..."
    # 예약 작업이 띄운 node 프로세스는 Stop-ScheduledTask로 안 죽는 경우가 있어
    # install-windows.ps1과 동일하게 프로세스를 직접 정리한 뒤 다시 시작한다.
    $nodePath = (Get-Command node).Source
    Get-Process -Name node -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $nodePath -and $_.MainWindowTitle -eq '' } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-ScheduledTask -TaskName 'MOTP-Server'
}

Write-Host "===================================================="
Write-Host "  업데이트 완료!  상태 확인: Get-ScheduledTask -TaskName MOTP-Server"
Write-Host "===================================================="
