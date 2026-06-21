const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/sales — list all sales orders
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.*, 
        json_agg(json_build_object(
          'id', soi.id,
          'product_id', soi.product_id,
          'product_name', p.name,
          'quantity', soi.quantity,
          'sales_price', p.sales_price,
          'on_hand_qty', p.on_hand_qty
        )) AS items
       FROM sales_orders so
       LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
       LEFT JOIN products p ON p.id = soi.product_id
       GROUP BY so.id
       ORDER BY so.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sales/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM sales_orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const items = await pool.query(
      `SELECT soi.*, p.name as product_name, p.sales_price
       FROM sales_order_items soi JOIN products p ON p.id = soi.product_id
       WHERE soi.sales_order_id = $1`, [req.params.id]
    );
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sales — create sales order
router.post('/', async (req, res) => {
  const { customer_name, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      'INSERT INTO sales_orders (customer_name) VALUES ($1) RETURNING *',
      [customer_name]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO sales_order_items (sales_order_id, product_id, quantity) VALUES ($1, $2, $3)',
        [orderId, item.product_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    
    // Automatically trigger constraint check and PO/MO generation
    const { autoProcessSalesOrder } = require('../services/orchestrator');
    const autoResult = await autoProcessSalesOrder(orderId);

    res.status(201).json({ ...orderResult.rows[0], items, autoMessage: autoResult.message, missingStock: autoResult.missingStock });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/sales/:id/confirm — confirm order (checks stock, generates PO/MO if short)
const { autoProcessSalesOrder } = require('../services/orchestrator');
router.patch('/:id/confirm', async (req, res) => {
  try {
    const result = await autoProcessSalesOrder(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sales/:id/deliver — mark as delivered (deducts stock)
router.patch('/:id/deliver', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const order = await client.query('SELECT * FROM sales_orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (order.rows[0].status !== 'CONFIRMED') return res.status(400).json({ error: 'Only CONFIRMED orders can be delivered' });

    const items = await client.query('SELECT * FROM sales_order_items WHERE sales_order_id = $1', [req.params.id]);

    for (const item of items.rows) {
      // Deduct from on_hand and reserved
      await client.query(
        'UPDATE products SET on_hand_qty = on_hand_qty - $1, reserved_qty = reserved_qty - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
      // Log to stock ledger
      await client.query(
        'INSERT INTO stock_ledger (product_id, change_qty, reason, reference_id) VALUES ($1, $2, $3, $4)',
        [item.product_id, -item.quantity, 'Sales Delivery', req.params.id]
      );
    }

    await client.query('UPDATE sales_orders SET status = $1 WHERE id = $2', ['DELIVERED', req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Order delivered, stock deducted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/sales/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('SELECT * FROM sales_orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    // If CONFIRMED, release reserved stock
    if (order.rows[0].status === 'CONFIRMED') {
      const items = await client.query('SELECT * FROM sales_order_items WHERE sales_order_id = $1', [req.params.id]);
      for (const item of items.rows) {
        await client.query(
          'UPDATE products SET reserved_qty = reserved_qty - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }

    await client.query('UPDATE sales_orders SET status = $1 WHERE id = $2', ['CANCELLED', req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Order cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
