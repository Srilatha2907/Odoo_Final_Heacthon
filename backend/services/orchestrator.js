const pool = require('../db');

/**
 * Checks stock and generates POs/MOs for any shortfall.
 * Does NOT consume or update inventory instantly.
 */
async function fulfillProduct(client, productId, requiredQty, generatedOrders) {
  const prodRes = await client.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (prodRes.rows.length === 0) throw new Error(`Product ID ${productId} not found`);
  const product = prodRes.rows[0];

  const available = product.on_hand_qty - product.reserved_qty;
  if (available >= requiredQty) {
    return { shortfall: 0 };
  }

  const shortfall = requiredQty - available;

  if (product.procurement_type === 'PURCHASE') {
    const poRes = await client.query(
      "INSERT INTO purchase_orders (vendor_name, status) VALUES ('Automated Vendor', 'DRAFT') RETURNING id"
    );
    const poId = poRes.rows[0].id;
    await client.query(
      'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity) VALUES ($1, $2, $3)',
      [poId, productId, shortfall]
    );
    generatedOrders.po.push(poId);
    console.log(`[ORCHESTRATOR] Generated DRAFT PO: ${poId} for ${shortfall} x ${product.name}`);
  } else if (product.procurement_type === 'MANUFACTURING') {
    const bomRes = await client.query('SELECT id FROM bom WHERE product_id = $1', [productId]);
    if (bomRes.rows.length === 0) {
      throw new Error(`Cannot manufacture ${product.name}: No Bill of Materials defined.`);
    }
    const bomId = bomRes.rows[0].id;

    const components = await client.query('SELECT * FROM bom_components WHERE bom_id = $1', [bomId]);
    for (const comp of components.rows) {
      const neededRawQty = comp.quantity * shortfall;
      await fulfillProduct(client, comp.component_id, neededRawQty, generatedOrders);
    }

    const moRes = await client.query(
      "INSERT INTO manufacturing_orders (product_id, quantity, status, start_date, end_date) VALUES ($1, $2, 'DRAFT', NOW(), NOW()) RETURNING id",
      [productId, shortfall]
    );
    const moId = moRes.rows[0].id;
    generatedOrders.mo.push(moId);
    console.log(`[ORCHESTRATOR] Generated DRAFT MO: ${moId} for ${shortfall} x ${product.name}`);
  }

  return { shortfall };
}

/**
 * Auto-Fulfill: Checks if an order can be delivered. 
 * If short, generates dependencies and keeps order in DRAFT.
 * If available, delivers immediately.
 */
async function autoProcessSalesOrder(salesOrderId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM sales_orders WHERE id = $1', [salesOrderId]);
    if (orderRes.rows.length === 0) throw new Error('Sales Order not found');
    const order = orderRes.rows[0];

    if (order.status !== 'DRAFT' && order.status !== 'CONFIRMED') {
        throw new Error('Order is already processed or cancelled.');
    }

    const items = await client.query('SELECT * FROM sales_order_items WHERE sales_order_id = $1', [salesOrderId]);

    let hasShortage = false;
    let generatedOrders = { po: [], mo: [] };

    // 1. Check all items for shortages and generate dependencies
    for (const item of items.rows) {
      const { shortfall } = await fulfillProduct(client, item.product_id, item.quantity, generatedOrders);
      if (shortfall > 0) {
        hasShortage = true;
      }
    }

    if (hasShortage) {
      // Shortage exists. POs/MOs were generated.
      // We STILL confirm the order and reserve the stock so it is known we owe this stock.
      for (const item of items.rows) {
        if (order.status !== 'CONFIRMED') {
          await client.query(
              'UPDATE products SET reserved_qty = reserved_qty + $1 WHERE id = $2',
              [item.quantity, item.product_id]
          );
        }
      }
      await client.query("UPDATE sales_orders SET status = 'CONFIRMED' WHERE id = $1", [salesOrderId]);
      await client.query('COMMIT');
      let nextSteps = [];
      if (generatedOrders.po.length > 0) nextSteps.push("1. Purchase Manager must review and receive the required items.");
      if (generatedOrders.mo.length > 0) nextSteps.push("2. Production Manager must complete the manufacturing orders.");
      
      const msg = `Inventory Shortage: ${generatedOrders.po.length} Purchase Order(s) and ${generatedOrders.mo.length} Manufacturing Order(s) were automatically generated. 
Next Steps: 
${nextSteps.join('\n')}
Once stock is replenished, you can successfully deliver this Sales Order.`;
      console.log(`[ORCHESTRATOR] Shortage detected.`);

      return { success: true, missingStock: true, generatedOrders, message: msg };
    }

    // 2. No shortage. Reserve stock and Confirm order.
    for (const item of items.rows) {
        if (order.status !== 'CONFIRMED') {
          await client.query(
              'UPDATE products SET reserved_qty = reserved_qty + $1 WHERE id = $2',
              [item.quantity, item.product_id]
          );
        }
    }

    await client.query("UPDATE sales_orders SET status = 'CONFIRMED' WHERE id = $1", [salesOrderId]);
    await client.query('COMMIT');
    console.log(`[ORCHESTRATOR] Sales Order ${salesOrderId} processed and CONFIRMED.`);

    return { success: true, missingStock: false, message: 'Stock is available. Order CONFIRMED successfully!' };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ORCHESTRATOR ERROR]', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { autoProcessSalesOrder };
