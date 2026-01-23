$path = "C:\Users\WFSYSTEM\Documents\Consolidacion-asp\src\app\admin\page.tsx"
$content = Get-Content $path -Encoding UTF8
$cleanContent = $content | Where-Object { 
    $_ -notmatch "pData" -and 
    $_ -notmatch "cedulaEtapaMap" -and 
    $_ -notmatch "personasData" 
}
$cleanContent | Set-Content $path -Encoding UTF8
Write-Host "Limpieza completada"
