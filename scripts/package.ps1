$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$manifest = Get-Content -LiteralPath (Join-Path $project 'manifest.json') -Raw | ConvertFrom-Json
$output = Join-Path $project 'dist'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$staging = Join-Path $output ('furipop-' + $manifest.version + '-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
$include = @('manifest.json', 'background.js', 'content', 'engine', 'icons', 'options', 'popup', 'vendor')
foreach ($name in $include) {
    Copy-Item -LiteralPath (Join-Path $project $name) -Destination $staging -Recurse
}
# Verify every copied runtime file before creating the archive.
foreach ($name in $include) {
    $original = Get-Item -LiteralPath (Join-Path $project $name)
    $files = if ($original.PSIsContainer) { Get-ChildItem -LiteralPath $original.FullName -File -Recurse } else { @($original) }
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($project.Length).TrimStart('\')
        $copy = Join-Path $staging $relative
        if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash) {
            throw "Package verification failed: $relative"
        }
    }
}
$required = @($manifest.background.service_worker, $manifest.action.default_popup, $manifest.options_ui.page)
foreach ($script in $manifest.content_scripts) { $required += @($script.js) + @($script.css) }
foreach ($resource in $required) {
    if ($resource -and -not (Test-Path -LiteralPath (Join-Path $staging $resource) -PathType Leaf)) { throw "Manifest resource missing: $resource" }
}
$archive = Join-Path $output ('furipop-' + $manifest.version + '-' + [guid]::NewGuid().ToString('N') + '.zip')
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
    $entries = @{}; foreach ($entry in $zip.Entries) { if ($entry.Name) { $entries[$entry.FullName.Replace('\','/')] = $entry } }
    $stagedFiles = @(Get-ChildItem -LiteralPath $staging -File -Recurse)
    if ($entries.Count -ne $stagedFiles.Count) { throw 'ZIP file count does not match staged files' }
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        foreach ($file in $stagedFiles) {
            $relative = $file.FullName.Substring($staging.Length).TrimStart('\').Replace('\','/')
            $entry = $entries[$relative]; if (-not $entry) { throw "Missing ZIP entry: $relative" }
            $stream = $entry.Open(); try { $actual = [Convert]::ToBase64String($sha.ComputeHash($stream)) } finally { $stream.Dispose() }
            $stream = [IO.File]::OpenRead($file.FullName); try { $expected = [Convert]::ToBase64String($sha.ComputeHash($stream)) } finally { $stream.Dispose() }
            if ($actual -ne $expected) { throw "ZIP entry does not match: $relative" }
        }
    } finally { $sha.Dispose() }
} finally { $zip.Dispose() }
Write-Output "Unpacked extension: $staging"
Write-Output "Archive: $archive"
Write-Output ('Archive size: {0:N2} MiB' -f ((Get-Item -LiteralPath $archive).Length / 1MB))
