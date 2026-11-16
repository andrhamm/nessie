#!/usr/bin/env bash
# Downloads third-party datasheets into docs/hardware/datasheets/ (git-ignored;
# vendors' copyright, not redistributed here) and parses each to text with liteparse.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/docs/hardware/datasheets"
mkdir -p "$DIR"
while read -r name url; do
  [ -z "$name" ] && continue
  pdf="$DIR/$name.pdf"
  [ -s "$pdf" ] || { echo "fetch $name"; curl -fsSL -o "$pdf" "$url"; }
  if command -v lit >/dev/null; then
    [ -s "$DIR/$name-parsed.txt" ] || lit parse "$pdf" --no-ocr --format text -o "$DIR/$name-parsed.txt"
  fi
done <<'LIST'
es7210-datasheet https://files.waveshare.com/wiki/common/ES7210_DS.pdf
es8311-user-guide https://files.waveshare.com/wiki/common/ES8311.user.Guide.pdf
esp32-p4-chip-revision-v1.3-datasheet-v1.0 https://documentation.espressif.com/esp32-p4-chip-revision-v1.3_datasheet_en.pdf
esp32-s3-datasheet https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/res/esp32-s3_datasheet.pdf
espressif-esp-vocat-schematic-v1.2 https://dl.espressif.com/AE/esp-dev-kits/ESP-VoCat_SCH_V1_2.pdf
waveshare-esp32-p4-wifi6-datasheet https://files.waveshare.com/wiki/ESP32-P4-WIFI6/ESP32-P4-WIFI6-datasheet.pdf
waveshare-esp32-s3-audio-board-schematic-v1.1 https://files.waveshare.com/wiki/ESP32-S3-AUDIO-Board/ESP32-S3-AUDIO-Board_1.1.pdf
LIST
command -v lit >/dev/null || echo "lit not found: install @llamaindex/liteparse to generate *-parsed.txt"
