<#
.SYNOPSIS
  Drift checker for the Code Mentor shared-core layout.

  Verifies that:
    1. Each root copy (.opencode/agents, .claude/agents, .agents/agents)
       is byte-identical (after CRLF normalization) to its adapter source
       under adapters/<platform>/.
    2. Each adapter's "## Session Todo" block (marker to EOF) is identical
       to the canonical CORE_PROTOCOL.md block, and the text before the
       marker contains the mentor-specific checkpoint heading.

.EXITCODE
  0 if every check passes, 1 if any check fails.
#>

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$marker = '## Session Todo'

$failures = 0

$core = Get-Content -LiteralPath (Join-Path $repo 'CORE_PROTOCOL.md') -Raw
$coreIdx = $core.IndexOf($marker)
if ($coreIdx -lt 0) {
  $failures++
  Write-Output "MISMATCH CORE_PROTOCOL.md missing marker '$marker'"
  $coreBlock = ''
} else {
  $coreBlock = $core.Substring($coreIdx)
}

$pairs = @{
  'study-mode' = @(
    @('.opencode/agents/study-mode.md', 'adapters/opencode/.opencode/agents/study-mode.md'),
    @('.claude/agents/study-mode.md', 'adapters/claude/.claude/agents/study-mode.md'),
    @('.agents/agents/study-mode.md', 'adapters/antigravity/.agents/agents/study-mode.md')
  )
  'debug-mentor' = @(
    @('.opencode/agents/debug-mentor.md', 'adapters/opencode/.opencode/agents/debug-mentor.md'),
    @('.claude/agents/debug-mentor.md', 'adapters/claude/.claude/agents/debug-mentor.md'),
    @('.agents/agents/debug-mentor.md', 'adapters/antigravity/.agents/agents/debug-mentor.md')
  )
  'refactor-mentor' = @(
    @('.opencode/agents/refactor-mentor.md', 'adapters/opencode/.opencode/agents/refactor-mentor.md'),
    @('.claude/agents/refactor-mentor.md', 'adapters/claude/.claude/agents/refactor-mentor.md'),
    @('.agents/agents/refactor-mentor.md', 'adapters/antigravity/.agents/agents/refactor-mentor.md')
  )
}

$checkpoint = @{
  'study-mode' = '## STUDY CHECKPOINT format'
  'debug-mentor' = '## DEBUG CHECKPOINT format'
  'refactor-mentor' = '## REFACTOR CHECKPOINT format'
}

function Get-Normalized {
  param([string]$Path)
  $text = Get-Content -LiteralPath $Path -Raw
  return $text -replace "`r`n", "`n"
}

function Test-Identical {
  param([string]$a, [string]$b)
  if ($a -eq $b) { return $true }
  return ($a -replace "`r`n", "`n") -eq ($b -replace "`r`n", "`n")
}

foreach ($mentor in $pairs.Keys) {
  foreach ($pair in $pairs[$mentor]) {
    $root = Join-Path $repo $pair[0]
    $adapter = Join-Path $repo $pair[1]
    $label = "$($pair[0]) <-> $($pair[1])"

    if (-not (Test-Path -LiteralPath $root) -or -not (Test-Path -LiteralPath $adapter)) {
      $failures++
      Write-Output "MISMATCH $label  (missing file)"
      continue
    }

    $hashRoot = (Get-FileHash -LiteralPath $root -Algorithm SHA256).Hash
    $hashAdp = (Get-FileHash -LiteralPath $adapter -Algorithm SHA256).Hash
    if ($hashRoot -eq $hashAdp) {
      Write-Output "OK $label"
    } elseif (Test-Identical (Get-Normalized $root) (Get-Normalized $adapter)) {
      Write-Output "OK $label  (identical after CRLF normalization)"
    } else {
      $failures++
      Write-Output "MISMATCH $label"
    }
  }
}

foreach ($mentor in $pairs.Keys) {
  foreach ($pair in $pairs[$mentor]) {
    $adapter = Join-Path $repo $pair[1]
    $label = "core block in $($pair[1])"

    if (-not (Test-Path -LiteralPath $adapter)) {
      $failures++
      Write-Output "MISMATCH $label  (missing file)"
      continue
    }

    $body = Get-Normalized $adapter
    $idx = $body.IndexOf($marker)
    if ($idx -lt 0) {
      $failures++
      Write-Output "MISMATCH $label  (marker '$marker' not found)"
      continue
    }

    $ok = $true
    $block = $body.Substring($idx)
    if (-not (Test-Identical $block $coreBlock)) {
      $ok = $false
      $failures++
      Write-Output "MISMATCH $label  (CORE block differs from CORE_PROTOCOL.md)"
    }
    $head = $body.Substring(0, $idx)
    if ($head.IndexOf($checkpoint[$mentor]) -lt 0) {
      $ok = $false
      $failures++
      Write-Output "MISMATCH $label  (mentor heading '$($checkpoint[$mentor])' missing before marker)"
    }
    if ($ok) {
      Write-Output "OK $label"
    }
  }
}

if ($failures -gt 0) {
  Write-Output "FAIL: $failures mismatch(es)"
  exit 1
}

Write-Output 'ALL OK'
exit 0
