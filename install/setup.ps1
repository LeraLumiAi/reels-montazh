# Установка навыка монтажа на Windows. Запуск из папки навыка:
#   powershell -ExecutionPolicy Bypass -File install\setup.ps1
# Ставит Python-окружение (venv) и движок Remotion, скачивает модель. ffmpeg, Python и Node.js должны быть установлены
# (см. install/УСТАНОВКА.md, шаг 1).
$ErrorActionPreference = 'Stop'
$skill = Split-Path -Parent $PSScriptRoot
Set-Location $skill

# Окружение Python держим вне OneDrive/Dropbox и вне AppData\Local (там его может перенести песочница приложения).
$venv = if ($env:MONTAZH_VENV) { $env:MONTAZH_VENV } else { Join-Path $HOME '.montazh-venv' }
if (-not (Test-Path "$venv\Scripts\python.exe")) {
  Write-Host "Создаю окружение Python: $venv"
  if (Get-Command py -ErrorAction SilentlyContinue) { py -3 -m venv $venv } else { python -m venv $venv }
}
& "$venv\Scripts\python.exe" -m pip install --upgrade pip
& "$venv\Scripts\python.exe" -m pip install -r "$skill\install\requirements.txt"

Write-Host 'Ставлю движок Remotion (npm ci)…'
Push-Location "$skill\remotion"
npm ci
Pop-Location

$model = "$skill\models\rvm_mobilenetv3_fp32.onnx"
if (-not (Test-Path $model)) {
  Write-Host 'Скачиваю модель для «слова за спикером» (15 МБ)…'
  Invoke-WebRequest -Uri 'https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx' -OutFile $model
}

& "$venv\Scripts\python.exe" "$skill\scripts\sfx_index.py"
Write-Host ''
Write-Host "Готово. Python навыка: $venv\Scripts\python.exe"
Write-Host 'Дальше: в папке, где будут видео, выполнить'
Write-Host "  & '$venv\Scripts\python.exe' '$skill\scripts\init.py'"
