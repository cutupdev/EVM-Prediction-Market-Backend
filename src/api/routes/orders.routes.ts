import { Router } from "express";
import * as orderbookService from "../../services/orderbook/orderbook.service.js";

export const ordersRouter = Router();

/**
 * Cancels a resting order. Uses query `requester` (wallet) so browser clients do not need a DELETE body.
 */
ordersRouter.delete("/:orderId", async (req, res, next) => {
  try {
    const requester = req.query.requester;
    if (typeof requester !== "string" || !/^0x[a-fA-F0-9]{40}$/i.test(requester)) {
      res.status(400).json({ error: "Query parameter requester (0x wallet) is required" });
      return;
    }
    const order = await orderbookService.cancelOrder(req.params.orderId, requester);
    res.json(order);
  } catch (e) {
    next(e);
  }
});
