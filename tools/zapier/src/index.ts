import { createZapierSdk } from "@zapier/zapier-sdk";

function createClient() {
  const clientId = process.env.ZAPIER_CREDENTIALS_CLIENT_ID?.trim();
  const clientSecret = process.env.ZAPIER_CREDENTIALS_CLIENT_SECRET?.trim();
  const directToken = process.env.ZAPIER_CREDENTIALS?.trim();

  if (clientId || clientSecret) {
    if (!clientId || !clientSecret) {
      throw new Error(
        "Set both ZAPIER_CREDENTIALS_CLIENT_ID and ZAPIER_CREDENTIALS_CLIENT_SECRET.",
      );
    }

    return createZapierSdk({
      credentials: {
        clientId,
        clientSecret,
      },
    });
  }

  if (directToken) {
    return createZapierSdk({ credentials: directToken });
  }

  return createZapierSdk();
}

const zapier = createClient();
const { data: profile } = await zapier.getProfile();

console.log(
  JSON.stringify(
    {
      authenticated: Boolean(profile.id),
    },
    null,
    2,
  ),
);
