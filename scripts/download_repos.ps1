# Download and update CromaX IDE AI Engine Sub-Repositories

$ErrorActionPreference = "Stop"

$reposDir = Join-Path -Path $PSScriptRoot -ChildPath "..\repos4Build"
if (-not (Test-Path $reposDir)) {
    New-Item -Path $reposDir -ItemType Directory | Out-Null
}

$repositories = @{
    "aider"        = "https://github.com/Aider-AI/aider.git"
    "ast-grep"     = "https://github.com/ast-grep/ast-grep.git"
    "hermes-agent" = "https://github.com/NousResearch/hermes-agent.git"
    "litellm"      = "https://github.com/BerriAI/litellm.git"
    "openclaw"     = "https://github.com/openclaw/openclaw.git"
    "OpenHands"    = "https://github.com/All-Hands-AI/OpenHands.git"
    "serena"       = "https://github.com/oraios/serena.git"
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Updating CromaX Sub-Repositories                 " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

foreach ($name in $repositories.Keys) {
    $targetPath = Join-Path -Path $reposDir -ChildPath $name
    $repoUrl = $repositories[$name]
    
    if (Test-Path (Join-Path -Path $targetPath -ChildPath ".git")) {
        Write-Host "[UPDATE] Pulling latest for $name..." -ForegroundColor Green
        git -C $targetPath pull --ff-only
    } else {
        Write-Host "[CLONE] Cloning $name from $repoUrl..." -ForegroundColor Yellow
        git clone $repoUrl $targetPath
    }
}

Write-Host "`nAll sub-repositories are up to date!" -ForegroundColor Green
