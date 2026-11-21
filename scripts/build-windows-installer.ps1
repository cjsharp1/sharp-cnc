# Build a Windows SharpCNC installer (NSIS + MSI) with Tauri 2.
# Run on Windows with Node 20+, Rust stable, and WebView2.
#
# Usage (from repo root, PowerShell):
#   .\scripts\build-windows-installer.ps1
#   .\scripts\build-windows-installer.ps1 -SkipInstall
#
# Artifacts land under:
#   src-tauri\target\release\bundle\nsis\
#   src-tauri\target\release\bundle\msi\

param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "==> SharpCNC Windows installer build" -ForegroundColor Cyan

if (-not $SkipInstall) {
  Write-Host "==> npm ci"
  npm ci
}

Write-Host "==> npm run tauri build (NSIS + MSI)"
npm run tauri -- build --bundles nsis,msi

$nsis = Get-ChildItem -Path "src-tauri\target\release\bundle\nsis" -Filter "*.exe" -ErrorAction SilentlyContinue
$msi = Get-ChildItem -Path "src-tauri\target\release\bundle\msi" -Filter "*.msi" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Build complete." -ForegroundColor Green
if ($nsis) {
  Write-Host "NSIS:" $nsis.FullName
} else {
  Write-Host "NSIS: (not found — check Tauri logs)"
}
if ($msi) {
  Write-Host "MSI: " $msi.FullName
} else {
  Write-Host "MSI:  (not found — check Tauri logs)"
}

Write-Host ""
Write-Host "Unsigned local builds are fine for personal use."
Write-Host "For GitHub Releases, prefer the windows-installer workflow artifacts."
