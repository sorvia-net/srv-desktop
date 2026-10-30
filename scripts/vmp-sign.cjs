const { execFileSync } = require("node:child_process");

exports.default = async function vmpSign(context) {
  if (!process.env.EVS_ACCOUNT_NAME) {
    console.log("  • VMP imzası atlandı: EVS hesabı tanımlı değil");
    return;
  }
  const python = process.platform === "win32" ? "python" : "python3";
  execFileSync(python, ["-m", "castlabs_evs.vmp", "sign-pkg", context.appOutDir], { stdio: "inherit" });
};
