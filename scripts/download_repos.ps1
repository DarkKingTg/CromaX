# scripts/download_repos.ps1
$ErrorActionPreference = "Continue"

$repos = @(
    @{ name="aider"; url="https://github.com/Aider-AI/aider.git" },
    @{ name="hermes-agent"; url="https://github.com/NousResearch/hermes-agent.git" },
    @{ name="openclaw"; url="https://github.com/openclaw/openclaw.git" },
    @{ name="serena"; url="https://github.com/oraios/serena.git" },
    @{ name="ast-grep"; url="https://github.com/ast-grep/ast-grep.git" },
    @{ name="litellm"; url="https://github.com/BerriAI/litellm.git" },
    @{ name="OpenHands"; url="https://github.com/All-Hands-AI/OpenHands.git" },
    @{ name="void"; url="https://github.com/voideditor/void.git" }
)

if (-not (Test-Path "repos4Build")) {
    New-Item -ItemType Directory -Force -Path "repos4Build" | Out-Null
}

foreach ($r in $repos) {
    $target = Join-Path "repos4Build" $r.name
    if (-not (Test-Path $target)) {
        Write-Host "=== Cloning $($r.name) from $($r.url) ==="
        git clone --depth 1 $r.url $target
    } else {
        Write-Host "=== $($r.name) already exists in repos4Build ==="
    }
}

Write-Host "=== All repos downloaded successfully! ==="
