Add-Type -AssemblyName System.Drawing
$path = "C:\Users\WFSYSTEM\.gemini\antigravity\brain\e11e1e21-fe7b-4443-a474-5968bcb15ad6\uploaded_image_1765917773667.jpg"

if (Test-Path $path) {
    try {
        $img = [System.Drawing.Bitmap]::FromFile($path)
        $totalR = 0; $totalG = 0; $totalB = 0; $count = 0
        $step = [Math]::Max(1, [Math]::Floor($img.Width / 20))
        
        for($x=0; $x -lt $img.Width; $x+=$step) {
            for($y=0; $y -lt $img.Height; $y+=$step) {
                $c = $img.GetPixel($x, $y)
                $totalR += $c.R; $totalG += $c.G; $totalB += $c.B; $count++
            }
        }
        
        if ($count -gt 0) {
            $avgR = [Math]::Round($totalR / $count)
            $avgG = [Math]::Round($totalG / $count)
            $avgB = [Math]::Round($totalB / $count)
            Write-Output "COLOR_HEX:#$("{0:X2}" -f [int]$avgR)$("{0:X2}" -f [int]$avgG)$("{0:X2}" -f [int]$avgB)"
        } else {
            Write-Output "ERROR: No pixels sampled"
        }
        $img.Dispose()
    } catch {
        Write-Output "ERROR: $($_.Exception.Message)"
    }
} else {
    Write-Output "ERROR: File not found at $path"
}
