// Self-host the dotLottie WASM so web animations never depend on a third-party CDN.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'node_modules', '@lottiefiles', 'dotlottie-web', 'dist', 'dotlottie-player.wasm');
const dest = path.join(__dirname, '..', 'public', 'dotlottie-player.wasm');
if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
