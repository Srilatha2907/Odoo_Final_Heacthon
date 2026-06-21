const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/manufacturing — list all MOs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mo.*, p.name as product_name,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'component_id', bc.component_id,
            'component_name', p2.name,
            'quantity', bc.quantity,
            'quantity_needed', bc.quantity * mo.quantity,
            'on_hand_qty', p2.on_hand_qty
          ))
          FROM bom b
          JOIN bom_components bc ON bc.bom_id = b.id
          JOIN products p2 ON p2.id = bc.component_id
          WHERE b.product_id = mo.product_id
          ), '[]'::json
        ) as components
       FROM manufacturing_orders mo 
       JOIN products p ON p.id = mo.product_id
       ORDER BY mo.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/manufacturing/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mo.*, p.name as product_name
       FROM manufacturing_orders mo JOIN products p ON p.id = mo.product_id
       WHERE mo.id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    // Get BoM for this product
    const bom = await pool.query(
      `SELECT bc.quantity, p2.name as component_name, p2.id as component_id, p2.on_hand_qty
       FROM bom b
       JOIN bom_components bc ON bc.bom_id = b.id
       JOIN products p2 ON p2.id = bc.component_id
       WHERE b.product_id = $1`, [result.rows[0].product_id]
    );

    res.json({ ...result.rows[0], bom_components: bom.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/manufacturing — create manufacturing order
router.post('/', async (req, res) => {
  const { product_id, quantity, start_date, end_date } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO manufacturing_orders (product_id, quantity, start_date, end_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [product_id, quantity, start_date || null, end_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/manufacturing/:id/start — start MO (consume raw materials)
router.patch('/:id/start', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mo = await client.query('SELECT * FROM manufacturing_orders WHERE id = $1', [req.params.id]);
    if (mo.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (mo.rows[0].status !== 'DRAFT' && mo.rows[0].status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Order cannot be started' });
    }

    const moData = mo.rows[0];

    // Get BoM components (scaled by MO quantity)
    const components = await client.query(
      `SELECT bc.component_id, bc.quantity * $1 as needed_qty, p.on_hand_qty, p.name
       FROM bom b
       JOIN bom_components bc ON bc.bom_id = b.id
       JOIN products p ON p.id = bc.component_id
       WHERE b.product_id = $2`, [moData.quantity, moData.product_id]
    );

    // Check all components have enough stock
    for (const comp of components.rows) {
      if (comp.on_hand_qty < comp.needed_qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Insufficient stock for component: ${comp.name}. Need ${comp.needed_qty}, have ${comp.on_hand_qty}`
        });
      }
    }

    // Consume raw materials
    for (const comp of components.rows) {
      await client.query(
        'UPDATE products SET on_hand_qty = on_hand_qty - $1 WHERE id = $2',
        [comp.needed_qty, comp.component_id]
      );
      await client.query(
        'INSERT INTO stock_ledger (product_id, change_qty, reason, reference_id) VALUES ($1, $2, $3, $4)',
        [comp.component_id, -comp.needed_qty, 'Manufacturing Consumption', req.params.id]
      );
    }

    await client.query(
      'UPDATE manufacturing_orders SET status = $1, start_date = NOW() WHERE id = $2',
      ['IN_PROGRESS', req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Manufacturing started, raw materials consumed' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/manufacturing/:id/complete — complete MO (add finished product to stock)
router.patch('/:id/complete', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mo = await client.query('SELECT * FROM manufacturing_orders WHERE id = $1', [req.params.id]);
    if (mo.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (mo.rows[0].status !== 'IN_PROGRESS') return res.status(400).json({ error: 'Only IN_PROGRESS orders can be completed' });

    const moData = mo.rows[0];

    // Add finished product to stock
    await client.query(
      'UPDATE products SET on_hand_qty = on_hand_qty + $1 WHERE id = $2',
      [moData.quantity, moData.product_id]
    );

    // Log to stock ledger
    await client.query(
      'INSERT INTO stock_ledger (product_id, change_qty, reason, reference_id) VALUES ($1, $2, $3, $4)',
      [moData.product_id, moData.quantity, 'Manufacturing Output', req.params.id]
    );

    await client.query(
      'UPDATE manufacturing_orders SET status = $1, end_date = NOW() WHERE id = $2',
      ['COMPLETED', req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Manufacturing completed, finished goods added to stock' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/manufacturing/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  try {
    const mo = await pool.query('SELECT * FROM manufacturing_orders WHERE id = $1', [req.params.id]);
    if (mo.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (mo.rows[0].status === 'COMPLETED') return res.status(400).json({ error: 'Completed orders cannot be cancelled' });

    await pool.query('UPDATE manufacturing_orders SET status = $1 WHERE id = $2', ['CANCELLED', req.params.id]);
    res.json({ message: 'Manufacturing order cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
