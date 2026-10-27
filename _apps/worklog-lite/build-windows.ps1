$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
python -m pip install --requirement requirements-build.txt
if ($LASTEXITCODE -ne 0) { throw 'Build dependency installation failed.' }
python -m PyInstaller --noconfirm --clean --onefile --windowed --name WorklogLite --add-data 'static;static' --hidden-import seed --hidden-import smoke_test desktop.py
if ($LASTEXITCODE -ne 0) { throw 'Windows executable build failed.' }
Write-Host 'Built dist\WorklogLite.exe'
