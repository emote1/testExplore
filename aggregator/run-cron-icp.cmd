@echo off
setlocal
cd /d "c:\Users\podde\OneDrive\Desktop\reefTest\testExplore\aggregator"
set "LOG_DIR=c:\Users\podde\OneDrive\Desktop\reefTest\testExplore\aggregator\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOG_FILE=%LOG_DIR%\cron-icp.log"
echo ==== %DATE% %TIME% ==== >> "%LOG_FILE%"
wsl.exe -e bash -lc "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH:$HOME/.local/share/dfx/bin:$HOME/.dfx/bin; DFX_BIN=\"$HOME/.dfx/bin/dfx\"; if [ ! -x \"$DFX_BIN\" ]; then DFX_BIN=\"$HOME/.local/share/dfx/bin/dfx\"; fi; if [ -x \"$DFX_BIN\" ]; then export DFX_BIN; else unset DFX_BIN; fi; export DFX_IDENTITY=cron; export DFX_WARNING=-mainnet_plaintext_identity; export RETRY_COUNT=3; export RETRY_DELAY_MS=30000; export NEW_WALLETS_LIMIT=50; export NVM_DIR=\"$HOME/.nvm\"; [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\"; cd /mnt/c/Users/podde/OneDrive/Desktop/reefTest/testExplore/aggregator && npm run cron:icp" >> "%LOG_FILE%" 2>&1
endlocal
