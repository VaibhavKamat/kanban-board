$ErrorActionPreference = "Stop"

$ContainerName = "kanban-app"

$existing = docker ps -a --filter "name=^/$ContainerName`$" --format "{{.Names}}"
if ($existing) {
    docker rm -f $ContainerName
    Write-Host "Stopped and removed $ContainerName"
} else {
    Write-Host "No container named $ContainerName found"
}
