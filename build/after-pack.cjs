const fs = require('fs')
const path = require('path')

/**
 * Ship Linux example config beside the packaged binary (AppImage/deb) for portable editing.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return

  const src = path.join(__dirname, '..', 'electron', 'os-switch.linux-host.example.json')
  const dest = path.join(context.appOutDir, 'os-switch.config.example.json')

  if (!fs.existsSync(src)) {
    console.warn('after-pack: missing', src)
    return
  }

  fs.copyFileSync(src, dest)
}
