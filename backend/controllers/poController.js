// controllers/poController.js
const poModel = require("../models/poModel");
const { writeAudit } = require("../utils/audit");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

// POST /api/purchase-orders
exports.createOrder = async (req, res) => {
  try {
    const { date, calcRunId, items } = req.body;

    if (!date || !calcRunId || !items || items.length === 0) {
      return res.status(400).json({ message: "date, calcRunId, and items are required" });
    }

    // Check if PO already exists for this date
    const existing = await poModel.getPurchaseOrderByDate(date);
    if (existing) {
      return res.status(409).json({
        message: "A purchase order already exists for this date",
        existingId: existing.id,
        status: existing.status,
      });
    }

    const po = await poModel.createPurchaseOrder({
      calcRunId,
      poDate: date,
      items,
      createdBy: req.user?.id,
    });

    await writeAudit({
      req,
      action: "CREATE_PO",
      entity: "purchase_orders",
      entity_id: String(po.id),
      new_value: { billNumber: po.billNumber, date, itemCount: po.itemCount, total: po.original_total },
      details: { message: `Draft PO ${po.billNumber} created for ${date}` },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({
      message: "Purchase order created",
      po: {
        id: po.id,
        billNumber: po.bill_number || po.billNumber,
        status: po.status,
        date: po.po_date,
        originalTotal: parseFloat(po.original_total),
        itemCount: po.itemCount,
      },
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to create purchase order" });
  }
};

// PUT /api/purchase-orders/:id
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "items are required" });
    }

    const result = await poModel.updatePurchaseOrder(id, { items });

    await writeAudit({
      req,
      action: "UPDATE_PO",
      entity: "purchase_orders",
      entity_id: String(id),
      new_value: { itemCount: result.itemCount, total: result.originalTotal },
      details: { message: `PO updated with ${result.itemCount} items` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({ message: "Purchase order updated", result });
  } catch (error) {
    console.error("UPDATE ORDER ERROR:", error);
    res.status(error.message.includes("draft") ? 403 : 500).json({
      message: error.message || "Failed to update purchase order",
    });
  }
};

// POST /api/purchase-orders/:id/submit
exports.submitOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const po = await poModel.submitForApproval(id, req.user?.id);

    await writeAudit({
      req,
      action: "SUBMIT_PO",
      entity: "purchase_orders",
      entity_id: String(id),
      new_value: { status: "pending", submittedAt: po.submitted_at },
      details: { message: `PO ${po.bill_number} submitted for approval` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({
      message: "Purchase order submitted for approval",
      po: { id: po.id, status: po.status, billNumber: po.bill_number },
    });
  } catch (error) {
    console.error("SUBMIT ORDER ERROR:", error);
    res.status(error.message.includes("draft") ? 403 : 500).json({
      message: error.message || "Failed to submit purchase order",
    });
  }
};

// POST /api/purchase-orders/:id/revise
exports.reviseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const po = await poModel.revisePurchaseOrder(id);

    await writeAudit({
      req,
      action: "REVISE_PO",
      entity: "purchase_orders",
      entity_id: String(id),
      new_value: { status: "draft" },
      details: { message: `PO ${po.bill_number} returned to draft for revision` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({
      message: "Purchase order returned to draft for revision",
      po: { id: po.id, status: po.status, billNumber: po.bill_number },
    });
  } catch (error) {
    console.error("REVISE ORDER ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to revise purchase order" });
  }
};

// POST /api/purchase-orders/:id/approve
exports.approveOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { revisions } = req.body;

    const result = await poModel.approvePurchaseOrder(id, req.user?.id, { revisions });

    await writeAudit({
      req,
      action: "APPROVE_PO",
      entity: "purchase_orders",
      entity_id: String(id),
      new_value: { status: "approved", revisedTotal: result.revisedTotal },
      details: {
        message: `PO approved with total Rs. ${result.revisedTotal}`,
        hasRevisions: Object.keys(revisions || {}).length > 0,
      },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({
      message: "Purchase order approved",
      result,
    });
  } catch (error) {
    console.error("APPROVE ORDER ERROR:", error);
    res.status(error.message.includes("pending") ? 403 : 500).json({
      message: error.message || "Failed to approve purchase order",
    });
  }
};

// GET /api/purchase-orders?status=pending
exports.rejectOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const po = await poModel.rejectPurchaseOrder(id, req.user?.id, reason.trim());

    await writeAudit({
      req,
      action: "REJECT_PO",
      entity: "purchase_orders",
      entity_id: String(id),
      new_value: { status: "rejected", reason: reason.trim() },
      details: { message: `PO ${po.bill_number} rejected: ${reason.trim()}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({
      message: "Purchase order rejected",
      po: { id: po.id, status: po.status, billNumber: po.bill_number },
    });
  } catch (error) {
    console.error("REJECT ORDER ERROR:", error);
    res.status(error.message.includes("pending") ? 403 : 500).json({
      message: error.message || "Failed to reject purchase order",
    });
  }
};

// GET /api/purchase-orders
exports.getOrders = async (req, res) => {
  try {
    const { status } = req.query;

    let orders;
    if (status) {
      orders = await poModel.getPurchaseOrdersByStatus(status);
    } else {
      orders = await poModel.getAllPurchaseOrders();
    }

    res.json({ orders });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch purchase orders" });
  }
};

// GET /api/purchase-orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const po = await poModel.getPurchaseOrderById(id);

    if (!po) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    res.json({ po });
  } catch (error) {
    console.error("GET ORDER BY ID ERROR:", error);
    res.status(500).json({ message: "Failed to fetch purchase order" });
  }
};

// GET /api/purchase-orders/by-date?date=YYYY-MM-DD
exports.getOrderByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });

    const po = await poModel.getPurchaseOrderByDate(date);
    res.json({ po: po || null });
  } catch (error) {
    console.error("GET ORDER BY DATE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch purchase order" });
  }
};

// GET /api/purchase-orders/pending
exports.getPendingOrders = async (req, res) => {
  try {
    const orders = await poModel.getPurchaseOrdersByStatus("pending");
    res.json({ orders });
  } catch (error) {
    console.error("GET PENDING ORDERS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch pending orders" });
  }
};

// GET /api/purchase-orders/:id/downloadpdf
exports.emailPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email address is required" });
    }

    // Fetch the PO details so we can include the Bill Number in the subject
    const po = await poModel.getPurchaseOrderById(id);
    if (!po) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    // Configure NodeMailer Transporter
    // Make sure you have EMAIL_USER and EMAIL_APP_PASSWORD in your .env file
    const transporter = nodemailer.createTransport({
      service: 'gmail', 
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_APP_PASSWORD 
      }
    });

    // Define the Email content
    const mailOptions = {
      from: `"Gampaha District General Hospital" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Purchase Order - Bill No: ${po.bill_number || po.billNumber}`,
      text: `Dear Manager,\n\nPlease find the details for Purchase Order #${po.bill_number || po.billNumber} attached or accessible via your supplier portal.\n\nDate: ${po.po_date || po.date}\nTotal Items: ${po.itemCount}\n\nThank you,\nGampaha District General Hospital`,
    };

    // Send the Email
    await transporter.sendMail(mailOptions);

    // Optional: Write to audit log that an email was sent
    await writeAudit({
      req,
      action: "EMAIL_PO",
      entity: "purchase_orders",
      entity_id: String(id),
      new_value: { emailedTo: email },
      details: { message: `PO ${po.bill_number || po.billNumber} emailed to ${email}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("EMAIL ERROR:", error);
    res.status(500).json({ message: "Failed to send email. Check server logs." });
  }
};

// GET /api/purchase-orders/:id/downloadpdf
exports.emailPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email address is required" });
    }

    //Fetch the PO Details
    const po = await poModel.getPurchaseOrderById(id);
    if (!po) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    // Handle nested categories if they exist, or flat items
    let itemsList = po.items || [];
    if (itemsList.length === 0 && po.categories) {
      itemsList = po.categories.flatMap((cat) => cat.items || []);
    }

    // GENERATE PDF IN-MEMORY
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      // Collect data chunks
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // Draw Header 
      doc.fontSize(20).text("PURCHASE ORDER", { align: "center" });
      doc.fontSize(10).fillColor("gray").text("Gampaha District General Hospital", { align: "center" });
      doc.moveDown(2);

      // Draw Info
      doc.fillColor("black").fontSize(12);
      doc.font("Helvetica-Bold").text("To:");
      doc.font("Helvetica").text("Manager,");
      doc.text("Multi Purpose Co-operative Society Ltd,");
      doc.text("Gampaha.");
      doc.moveDown();

      doc.font("Helvetica-Bold").text(`Bill No: `, { continued: true }).font("Helvetica").text(po.bill_number || po.billNumber || "N/A");
      doc.font("Helvetica-Bold").text(`Date: `, { continued: true }).font("Helvetica").text(po.po_date || po.date || "N/A");
      doc.font("Helvetica-Bold").text(`Status: `, { continued: true }).font("Helvetica").text((po.status || "").toUpperCase());
      doc.moveDown(2);

      // Draw Table Header 
      let top = doc.y;
      doc.font("Helvetica-Bold");
      doc.text("Item", 50, top);
      doc.text("Qty", 300, top);
      doc.text("Unit Price", 400, top);
      doc.text("Total (Rs)", 480, top);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("black").stroke();
      doc.moveDown(0.5);

      // Draw Table Rows 
      itemsList.forEach((item) => {
        // Auto page-break protection for large orders
        if (doc.y > 700) {
          doc.addPage();
          let newTop = doc.y;
          doc.font("Helvetica-Bold").fillColor("black");
          doc.text("Item", 50, newTop).text("Qty", 300, newTop).text("Unit Price", 400, newTop).text("Total (Rs)", 480, newTop);
          doc.moveDown(0.5).moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("black").stroke().moveDown(0.5);
        }

        top = doc.y;
        const lineTotal = item.revisedTotal !== null && item.revisedTotal !== undefined 
            ? Number(item.revisedTotal) 
            : Number(item.totalPrice);

        doc.font("Helvetica").fillColor("black");
        // Using English name to prevent Unicode font crashes in standard PDFKit
        doc.text(item.nameEn || item.itemName || "Unknown Item", 50, top, { width: 240 });
        doc.text(`${item.quantity} ${item.unit}`, 300, top);
        doc.text(`${Number(item.unitPrice).toLocaleString()}`, 400, top);
        doc.text(`${lineTotal.toLocaleString()}`, 480, top);
        
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cccccc").stroke();
        doc.moveDown(0.5);
      });

      // Draw Grand Total 
      doc.moveDown(2);
      const grandTotal = po.revisedTotal !== null && po.revisedTotal !== undefined 
          ? Number(po.revisedTotal) 
          : Number(po.originalTotal);
          
      doc.fillColor("black").fontSize(14).font("Helvetica-Bold")
         .text(`Grand Total: Rs. ${grandTotal.toLocaleString()}`, { align: "right" });

      doc.end();
    });

    //  CONFIGURE EMAIL
    const transporter = nodemailer.createTransport({
      service: 'gmail', 
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_APP_PASSWORD 
      }
    });

    // ATTACH PDF AND SEND
    const mailOptions = {
      from: `"Gampaha District General Hospital" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Purchase Order - Bill No: ${po.bill_number || po.billNumber}`,
      text: `Dear Manager,\n\nPlease find the details for Purchase Order #${po.bill_number || po.billNumber} attached as a PDF document.\n\nDate: ${po.po_date || po.date}\n\nThank you,\nGampaha District General Hospital`,
      attachments: [
        {
          filename: `Purchase_Order_${po.bill_number || po.billNumber}.pdf`,
          content: pdfBuffer, // The PDF we generated in memory!
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Email sent successfully with PDF attached" });
  } catch (error) {
    console.error("EMAIL ERROR:", error);
    res.status(500).json({ message: "Failed to send email. Check server logs." });
  }
};

// GET /api/purchase-orders/:id/downloadpdf
exports.downloadPurchaseOrderPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const po = await poModel.getPurchaseOrderById(id);
    if (!po) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    let itemsList = po.items || [];
    if (itemsList.length === 0 && po.categories) {
      itemsList = po.categories.flatMap((cat) => cat.items || []);
    }

    // Set headers to trigger a file download in the browser
    const filename = `Purchase_Order_${po.bill_number || po.billNumber}.pdf`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    // Create the PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Pipe the PDF directly to the HTTP response!
    doc.pipe(res);

    // Draw Header 
    doc.fontSize(20).text("PURCHASE ORDER", { align: "center" });
    doc.fontSize(10).fillColor("gray").text("Gampaha District General Hospital", { align: "center" });
    doc.moveDown(2);

    // Draw Info 
    doc.fillColor("black").fontSize(12);
    doc.font("Helvetica-Bold").text("To:");
    doc.font("Helvetica").text("Manager,");
    doc.text("Multi Purpose Co-operative Society Ltd,");
    doc.text("Gampaha.");
    doc.moveDown();

    doc.font("Helvetica-Bold").text(`Bill No: `, { continued: true }).font("Helvetica").text(po.bill_number || po.billNumber || "N/A");
    doc.font("Helvetica-Bold").text(`Date: `, { continued: true }).font("Helvetica").text(po.po_date || po.date || "N/A");
    doc.font("Helvetica-Bold").text(`Status: `, { continued: true }).font("Helvetica").text((po.status || "").toUpperCase());
    doc.moveDown(2);

    // Draw Table Header
    let top = doc.y;
    doc.font("Helvetica-Bold");
    doc.text("Item", 50, top);
    doc.text("Qty", 300, top);
    doc.text("Unit Price", 400, top);
    doc.text("Total (Rs)", 480, top);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("black").stroke();
    doc.moveDown(0.5);

    // Draw Table Rows 
    itemsList.forEach((item) => {
      if (doc.y > 700) {
        doc.addPage();
        let newTop = doc.y;
        doc.font("Helvetica-Bold").fillColor("black");
        doc.text("Item", 50, newTop).text("Qty", 300, newTop).text("Unit Price", 400, newTop).text("Total (Rs)", 480, newTop);
        doc.moveDown(0.5).moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("black").stroke().moveDown(0.5);
      }

      top = doc.y;
      const lineTotal = item.revisedTotal !== null && item.revisedTotal !== undefined 
          ? Number(item.revisedTotal) 
          : Number(item.totalPrice);

      doc.font("Helvetica").fillColor("black");
      doc.text(item.nameEn || item.itemName || "Unknown Item", 50, top, { width: 240 });
      doc.text(`${item.quantity} ${item.unit}`, 300, top);
      doc.text(`${Number(item.unitPrice).toLocaleString()}`, 400, top);
      doc.text(`${lineTotal.toLocaleString()}`, 480, top);
      
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cccccc").stroke();
      doc.moveDown(0.5);
    });

    // Draw Grand Total 
    doc.moveDown(2);
    const grandTotal = po.revisedTotal !== null && po.revisedTotal !== undefined 
        ? Number(po.revisedTotal) 
        : Number(po.originalTotal);
        
    doc.fillColor("black").fontSize(14).font("Helvetica-Bold")
       .text(`Grand Total: Rs. ${grandTotal.toLocaleString()}`, { align: "right" });

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error("PDF DOWNLOAD ERROR:", error);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
};