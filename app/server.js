/*
 * Next.js server setup
 */
require("isomorphic-fetch");
const dotenv = require("dotenv");
const Koa = require("koa");
const next = require("next");
const { default: createShopifyAuth } = require("@shopify/koa-shopify-auth");
const { verifyRequest } = require("@shopify/koa-shopify-auth");
const session = require("koa-session");

dotenv.config();
const { default: graphQLProxy } = require("@shopify/koa-shopify-graphql-proxy");
const Router = require("koa-router");
const getSubscriptionUrl = require("./server/getSubscriptionUrl");

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const bodyParser = require("koa-bodyparser");
const sendEmail = require("./server/sendEmail");
const cron = require('node-cron');

const { CLIENT_SECRET, CLIENT_ID, API_VERSION } = process.env;

app.prepare().then(() => {
  const server = new Koa();
  const router = new Router();
  server.use(session({ secure: true, sameSite: "none" }, server));
  server.keys = [CLIENT_SECRET];

  // Shop authentication and app subscription
  server.use(
    createShopifyAuth({
      apiKey: CLIENT_ID,
      secret: CLIENT_SECRET,
      scopes: ["read_products", "write_products"],
      async afterAuth(ctx) {
        const { shop, accessToken } = ctx.session;
        ctx.cookies.set("shopOrigin", shop, {
          httpOnly: false,
          secure: true,
          sameSite: "none",
        });
        await getSubscriptionUrl(ctx, accessToken, shop);
      },
    })
  );
  const scheduleEmail = (cronExpression, email, products) => {
    cron.schedule(cronExpression, async () => {
      try {
        await sendEmail(email, products);
        console.log(`Email sent to ${email} as per schedule.`);
      } catch (error) {
        console.error("Error sending scheduled email:", error);
      }
    });
  };

  router.post("/api/schedule-email", async (ctx) => {
    const { email, products, schedule } = ctx.request.body;
    // Example cronExpression for hourly: '0 * * * *', daily: '0 0 * * *', weekly: '0 0 * * 0'
    scheduleEmail(schedule, email, products);
    ctx.status = 200;
    ctx.body = "Email schedule set successfully";
  });

  server.use(graphQLProxy({ version: API_VERSION }));
  router.get("*", verifyRequest(), async (ctx) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  });

  server.use(bodyParser());
  server.use(router.allowedMethods());
  server.use(router.routes());

  // Start listening
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
