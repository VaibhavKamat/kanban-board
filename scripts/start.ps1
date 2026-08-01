$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$ImageName = "kanban-app"
$ContainerName = "kanban-app"
$VolumeName = "kanban-data"
$Port = 8000

docker build -t $ImageName .

$existing = docker ps -a --filter "name=^/$ContainerName`$" --format "{{.Names}}"
if ($existing) {
    docker rm -f $ContainerName
}

docker volume create $VolumeName | Out-Null

docker run -d --name $ContainerName -p "${Port}:8000" `
    -v "${VolumeName}:/app/data" -e KANBAN_DB_PATH=/app/data/kanban.db `
    --env-file .env $ImageName

Write-Host "Kanban app running at http://localhost:$Port"
