// No Mac, assina o app de forma ad-hoc (sem certificado pago) para que o macOS
// aceite abrir pelo caminho "Abrir mesmo assim" em vez de dizer que está danificado.
const { execSync } = require("child_process");
const path = require("path");
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== "darwin") return;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  execSync(`codesign --force --deep --sign - "${app}"`, { stdio: "inherit" });
};
