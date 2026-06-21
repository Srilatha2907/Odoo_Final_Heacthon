const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/purchase — list all purchase orders
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT po.*,
        json_agg(json_build_object(
          'id', poi.id,
          'product_id', poi.product_id,
          'product_name', p.name,
          'quantity', poi.quantity,
          'cost_price', p.cost_price
        )) AS items
       FROM purchase_orders po
       LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
       LEFT JOIN products p ON p.id = poi.product_id
       GROUP BY po.id
       ORDER BY po.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const items = await pool.query(
      `SELECT poi.*, p.name as product_name, p.cost_price
       FROM purchase_order_items poi JOIN products p ON p.id = poi.product_id
       WHERE poi.purchase_order_id = $1`, [req.params.id]
    );
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/purchase — create purchase order
router.post('/', async (req, res) => {
  const { vendor_name, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      'INSERT INTO purchase_orders (vendor_name) VALUES ($1) RETURNING *',
      [vendor_name]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity) VALUES ($1, $2, $3)',
        [orderId, item.product_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...orderResult.rows[0], items });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/purchase/:id/confirm — confirm purchase order
router.patch('/:id/confirm', async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (order.rows[0].status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT orders can be confirmed' });

    await pool.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', ['CONFIRMED', req.params.id]);
    res.json({ message: 'Purchase order confirmed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/purchase/:id/receive — receive goods (adds stock)
router.patch('/:id/receive', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const order = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (order.rows[0].status !== 'CONFIRMED') return res.status(400).json({ error: 'Only CONFIRMED orders can be received' });

    const items = await client.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [req.params.id]);

    for (const item of items.rows) {
      // Add stock
      await client.query(
        'UPDATE products SET on_hand_qty = on_hand_qty + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
      // Log to stock ledger
      await client.query(
        'INSERT INTO stock_ledger (product_id, change_qty, reason, reference_id) VALUES ($1, $2, $3, $4)',
        [item.product_id, item.quantity, 'Purchase Receipt', req.params.id]
      );
    }

    await client.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', ['RECEIVED', req.params.id]);
    await client.query('COMMIT');

    res.json({ message: 'Goods received, stock updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/purchase/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (order.rows[0].status === 'RECEIVED') return res.status(400).json({ error: 'Received orders cannot be cancelled' });

    await pool.query('UPDATE purchase_orders SET status = $1 WHERE id = $2', ['CANCELLED', req.params.id]);
    res.json({ message: 'Purchase order cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
