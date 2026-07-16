@echo off
setlocal

set INPUT=input.json
set OUTPUT=output.json

> "%OUTPUT%" echo {

powershell -NoLogo -Command ^
  "$raw = Get-Content '%INPUT%' -Raw;" ^
  "$json = $raw | ConvertFrom-Json;" ^
  "$pairs = @();" ^
  "foreach ($x in $json.result) {" ^
  "  if ($x.o -and $x.o.Count -gt 0) {" ^
  "    $kanji = $x.i;" ^
  "    $hv = $x.o[0];" ^
  "    $pairs += ('  \"' + $kanji + '\": \"' + $hv + '\",');" ^
  "  }" ^
  "};" ^
  "if ($pairs.Count -gt 0) { $pairs[-1] = $pairs[-1].TrimEnd(','); }" ^
  "$pairs | Add-Content '%OUTPUT%';"

>> "%OUTPUT%" echo }

echo Done.
