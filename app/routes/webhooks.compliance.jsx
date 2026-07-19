import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  try {
    const { shop, topic } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    if (topic === "SHOP_REDACT") {
      await db.session.deleteMany({ where: { shop } });
    }

    return new Response();
  } catch (error) {
    console.error("Webhook authentication failed:", error);

    if (error instanceof Response) {
      return error;
    }

    return new Response("Unauthorized", { status: 401 });
  }
};