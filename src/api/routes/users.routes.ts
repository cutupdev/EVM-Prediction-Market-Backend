import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

export const usersRouter = Router();

usersRouter.get("/:address/orders", async (req, res, next) => {
  try {
    const addr = req.params.address.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(addr)) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }
    const take = req.query.take ? Math.min(Number(req.query.take), 200) : 100;
    const orders = await prisma.order.findMany({
      where: { makerAddress: addr },
      orderBy: { createdAt: "desc" },
      take,
      include: { market: true },
    });
    res.json(orders);
  } catch (e) {
    next(e);
  }
});
