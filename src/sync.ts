import "dotenv/config";
import { loginViaEphemeralCallbackServer } from "./oauth.js";

async function main(): Promise<void> {
  const wantsLogin = process.argv.includes("--login");

  if (!wantsLogin) {
    console.log("Usage: npm run login");
    process.exitCode = 1;
    return;
  }

  await loginViaEphemeralCallbackServer(3000); // ? Port number for the ephemeral callback server
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Login flow failed:", message);
  process.exit(1);
});
