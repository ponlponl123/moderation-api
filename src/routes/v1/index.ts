import { Hono } from "hono/tiny";
import { moderateRouter } from "./moderate";

export const v1Router = new Hono();

v1Router.route("/moderate", moderateRouter);

export default v1Router;
