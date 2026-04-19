const invoiceModel = require("../models/invoiceModel");
const pool = require("../config/db");

// GET /api/invoices/pending-deliveries
exports.getPendingDeliveries = async (req, res) => {
  try {
    const deliveries = await invoiceModel.getPendingDeliveries();
    res.json({ deliveries });
  } catch (error) {
    console.error("GET PENDING DELIVERIES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch pending deliveries" });
  }
};

// GET /api/invoices/po/:poId
exports.getPoForReceiving = async (req, res) => {
  try {
    const { poId } = req.params;
    
    // Get the PO Details
    const poRes = await pool.query("SELECT * FROM purchase_orders WHERE id = $1", [poId]);
    if (poRes.rows.length === 0) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    const po = poRes.rows[0];

    // Get the specific items ordered in that PO
    const itemsRes = await pool.query(`
      SELECT 
        pi.id, pi.item_id as "itemId", pi.quantity, pi.unit_price as "unitPrice", 
        i.name_en as "nameEn", i.name_si as "nameSi", i.unit
      FROM po_items pi
      JOIN items i ON i.id = pi.item_id
      WHERE pi.po_id = $1
    `, [poId]);

    // Format for the frontend
    const poData = {
      id: po.id,
      billNumber: po.bill_number,
      items: itemsRes.rows
    };
    
    res.json({ po: poData });
  } catch (error) {
    console.error("GET PO FOR RECEIVING ERROR:", error);
    res.status(500).json({ message: "Failed to fetch PO details" });
  }
};

// POST /api/invoices/receive-delivery
exports.receiveDelivery = async (req, res) => {
  try {
    const { poId, invoiceNumber, invoiceDate, items, overallNotes } = req.body;

    if (!poId || !invoiceNumber || !items || items.length === 0) {
      return res.status(400).json({ message: "Missing required delivery data." });
    }

    // Calculate total billed amount based on what was ACTUALLY received
    const billedTotal = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);

    const invoiceData = {
      poId,
      invoiceNumber,
      invoiceDate,
      billedTotal,
      receivedBy: req.user?.id || null, // Assuming you have auth middleware
      notes: overallNotes
    };

    const newInvoice = await invoiceModel.createInvoice(invoiceData, items);

    res.status(201).json({
      message: "Delivery received and saved successfully.",
      invoiceId: newInvoice.id
    });

  } catch (error) {
    console.error("RECEIVE DELIVERY ERROR:", error);
    res.status(500).json({ message: "Failed to process delivery receipt." });
  }
};

// GET /api/invoices/issues
exports.getIssueReports = async (req, res) => {
  try {
    const issues = await invoiceModel.getIssueReports();
    res.json({ issues });
  } catch (error) {
    console.error("GET ISSUE REPORTS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch issue reports." });
  }
};