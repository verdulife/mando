# Modifies the PE header of a Windows executable to change the subsystem
# from CONSOLE (3) to WINDOWS (2), effectively hiding the terminal window.
param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

if (-not (Test-Path -LiteralPath $Path)) {
  throw "File not found: $Path"
}

$bytes = [System.IO.File]::ReadAllBytes($Path)

# PE header offset is at 0x3C (e_lfanew)
$peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
if ($peOffset -lt 0 -or $peOffset -gt $bytes.Length - 4) {
  throw "Invalid PE header offset"
}

# Verify PE signature 'PE\0\0'
if ($bytes[$peOffset] -ne 0x50 -or $bytes[$peOffset + 1] -ne 0x45 -or $bytes[$peOffset + 2] -ne 0 -or $bytes[$peOffset + 3] -ne 0) {
  throw "Invalid PE signature"
}

# COFF header follows the PE signature (20 bytes)
$coffHeaderOffset = $peOffset + 4
$optionalHeaderOffset = $coffHeaderOffset + 20

# Magic determines PE32 (0x10b) or PE32+ (0x20b)
$magic = [BitConverter]::ToUInt16($bytes, $optionalHeaderOffset)
if ($magic -ne 0x10b -and $magic -ne 0x20b) {
  throw "Unknown PE optional header magic: 0x$($magic.ToString('X4'))"
}

# Subsystem field is at offset 0x44 within the Optional Header for both PE32 and PE32+
$subsystemOffset = $optionalHeaderOffset + 0x44

$currentSubsystem = [BitConverter]::ToUInt16($bytes, $subsystemOffset)
if ($currentSubsystem -eq 2) {
  Write-Host "[$Path] Subsystem already WINDOWS (2). No change needed."
  exit 0
}

if ($currentSubsystem -ne 3) {
  Write-Warning "[$Path] Unexpected subsystem value: $currentSubsystem. Expected 3 (CONSOLE). Proceed with caution."
}

[BitConverter]::GetBytes([UInt16]2) | ForEach-Object -Begin { $i = 0 } { $bytes[$subsystemOffset + ($i++)] = $_ }
[System.IO.File]::WriteAllBytes($Path, $bytes)
Write-Host "[$Path] Subsystem changed from CONSOLE ($currentSubsystem) to WINDOWS (2)."
