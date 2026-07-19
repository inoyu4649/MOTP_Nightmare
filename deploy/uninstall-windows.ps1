# MOTP 서버 제거 (Windows) — install-windows.ps1이 만든 예약 작업/방화벽 규칙을 되돌린다.
$ErrorActionPreference = 'SilentlyContinue'

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Error "관리자 권한 PowerShell에서 실행하세요."
    exit 1
}

Write-Host "[제거] 예약 작업 중지/삭제..."
Stop-ScheduledTask -TaskName 'MOTP-Server' -ErrorAction SilentlyContinue
Stop-ScheduledTask -TaskName 'MOTP-Nginx' -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'MOTP-Server' -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'MOTP-Nginx' -Confirm:$false -ErrorAction SilentlyContinue

if (Test-Path 'C:\nginx\nginx.exe') {
    & 'C:\nginx\nginx.exe' -s stop 2>$null
}

Write-Host "[제거] 방화벽 규칙 삭제..."
Remove-NetFirewallRule -DisplayName 'MOTP HTTP' -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName 'MOTP HTTPS' -ErrorAction SilentlyContinue

Write-Host "완료. C:\nginx, C:\win-acme 및 다운로드된 SSL 인증서 파일은 삭제하지 않았습니다"
Write-Host "(필요하면 해당 폴더를 직접 삭제하세요). win-acme가 등록한 갱신용 예약 작업이"
Write-Host "남아있다면 'win-acme' 로 시작하는 작업을 작업 스케줄러에서 확인해 정리하세요."
