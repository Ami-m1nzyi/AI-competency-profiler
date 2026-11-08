# Starts this local copy without installing or changing dependencies.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$backendDir = Join-Path $projectDir 'backend'
$appFile = Join-Path $backendDir 'app.py'
$indexFile = Join-Path $backendDir 'static\index.html'
$logDir = Join-Path $projectDir 'logs'
$stateFile = Join-Path $logDir 'local-server.json'

function Test-Ready {
    param([int]$Port, [int]$ProcessId)
    try {
        $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
        if (-not ($listeners | Where-Object { $_.OwningProcess -eq $ProcessId })) { return $false }
        $baseUrl = "http://127.0.0.1:$Port"
        $page = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing -TimeoutSec 2
        if ($page.StatusCode -ne 200 -or $page.Content -notmatch '<div\s+id="root"') { return $false }
        # OPTIONS checks Flask routing without generating questions, sending mail,
        # changing data, or calling an external AI service.
        $api = Invoke-WebRequest -Uri "$baseUrl/api/login" -Method Options -UseBasicParsing -TimeoutSec 2
        return ($api.StatusCode -eq 200 -and $api.Headers['Allow'] -match 'POST')
    } catch { return $false }
}

function Test-FreePort {
    param([int]$Port)
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start(); return $true }
    catch { return $false }
    finally { $listener.Stop() }
}

try {
    if (-not (Test-Path -LiteralPath $appFile -PathType Leaf)) { throw 'Backend app.py is missing from this project.' }
    if (-not (Test-Path -LiteralPath $indexFile -PathType Leaf)) { throw 'The frontend build is missing from backend\static. Build the frontend first.' }
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null

    # Reuse only a server recorded by this launcher and still running this exact app.
    if (Test-Path -LiteralPath $stateFile -PathType Leaf) {
        try {
            $saved = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            $savedPort = [int]$saved.port
            $savedId = [int]$saved.processId
            if ($savedId -gt 0 -and $savedPort -ge 5000 -and $savedPort -le 5015 -and $saved.appFile -eq $appFile) {
                $ownedProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $savedId" -ErrorAction SilentlyContinue
                if ($ownedProcess -and $ownedProcess.CommandLine -and $ownedProcess.CommandLine.IndexOf($appFile, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and (Test-Ready -Port $savedPort -ProcessId $savedId)) {
                    $existingUrl = "http://127.0.0.1:$savedPort"
                    Write-Host "Opening existing AI-profiler: $existingUrl"
                    Start-Process -FilePath $existingUrl | Out-Null
                    exit 0
                }
            }
        } catch { Write-Host 'Previous server record is unavailable; checking for a free port.' }
    }

    $pythonCandidates = @(
        (Join-Path $backendDir 'venv\Scripts\python.exe'),
        (Join-Path $backendDir '.venv\Scripts\python.exe'),
        (Join-Path $projectDir '.venv\Scripts\python.exe')
    )
    $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        try {
            # A WindowsApps entry can be a working Python runtime alias.
            # Ask the interpreter for its real executable before checking dependencies.
            $resolvedPython = @(& $pythonCommand.Source -c 'import sys; print(sys.executable)' 2>$null)
            if ($LASTEXITCODE -eq 0 -and $resolvedPython.Count -gt 0) {
                $pythonCandidates += [string]$resolvedPython[-1]
            }
        } catch { Write-Host 'System Python could not be resolved; checking other environments.' }
    }
    $pyCommand = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($pyCommand) {
        try {
            $resolvedPython = @(& $pyCommand.Source -3 -c 'import sys; print(sys.executable)' 2>$null)
            if ($LASTEXITCODE -eq 0 -and $resolvedPython.Count -gt 0) { $pythonCandidates += [string]$resolvedPython[-1] }
        } catch { Write-Host 'Python launcher is unavailable; checking other environments.' }
    }
    $pythonExe = $null
    foreach ($candidate in ($pythonCandidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $probeOutput = & $candidate -c 'import flask, flask_cors, openai, dotenv, requests, httpx' 2>&1
            if ($LASTEXITCODE -eq 0) { $pythonExe = $candidate; break }
        } catch { continue }
    }
    if (-not $pythonExe) { throw 'No Python environment with the required dependencies was found. Prepare the dependencies in backend\requirements.txt, then run this launcher again. Nothing has been installed automatically.' }

    $port = $null
    foreach ($candidatePort in 5000..5015) {
        if (Test-FreePort -Port $candidatePort) { $port = $candidatePort; break }
    }
    if (-not $port) { throw 'Ports 5000-5015 are occupied. No running application was stopped. Free one of these ports and try again.' }
    if ($port -ne 5000) { Write-Host "Port 5000 is occupied; using free port $port. Existing applications are left running." }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $outputLog = Join-Path $logDir "server-$stamp.log"
    $errorLog = Join-Path $logDir "server-$stamp.error.log"
    $arguments = @('-m', 'flask', '--app', ('"{0}"' -f $appFile), 'run', '--host', '127.0.0.1', '--port', [string]$port, '--no-debugger', '--no-reload')
    $server = Start-Process -FilePath $pythonExe -ArgumentList $arguments -WorkingDirectory $backendDir -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru
    [pscustomobject]@{ processId = $server.Id; port = $port; appFile = $appFile; python = $pythonExe; started = (Get-Date).ToString('o'); outputLog = $outputLog; errorLog = $errorLog } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8

    Write-Host 'Waiting for the local application...'
    $watch = [Diagnostics.Stopwatch]::StartNew()
    while ($watch.Elapsed.TotalSeconds -lt 45) {
        $server.Refresh()
        if ($server.HasExited) { throw "The application could not start. See $errorLog" }
        if (Test-Ready -Port $port -ProcessId $server.Id) {
            $url = "http://127.0.0.1:$port"
            Write-Host "AI-profiler is ready: $url"
            Write-Host "Server logs: $logDir"
            Start-Process -FilePath $url | Out-Null
            exit 0
        }
        Start-Sleep -Milliseconds 300
    }
    throw "The application did not become ready within 45 seconds. The browser was not opened. See $errorLog. Server process: $($server.Id)."
} catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
