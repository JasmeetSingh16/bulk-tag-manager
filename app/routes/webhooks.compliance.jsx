import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    // Clean up any remaining session data for this shop
    await db.session.deleteMany({ where: { shop } });
  }

  // This app does not store any customer data, so customers/data_request
  // and customers/redact require no further action.

  return new Response();
};