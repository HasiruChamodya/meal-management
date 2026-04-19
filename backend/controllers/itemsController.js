const itemsModel = require("../models/itemsModel");

// GET /api/items
exports.getItems = async (req, res) => {
  try {
    const items = await itemsModel.getItems();
    res.json({ items });
  } catch (err) {
    console.error("GET ITEMS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch items" });
  }
};

// POST /api/items
exports.createItem = async (req, res) => {
  try {
    const item = await itemsModel.createItem(req.body);

    res.status(201).json({
      message: "Item created successfully",
      item
    });

  } catch (err) {
    console.error("CREATE ITEM ERROR:", err);
    res.status(500).json({ message: "Failed to create item" });
  }
};

// PUT /api/items/:id
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await itemsModel.updateItem(id, req.body);

    res.json({
      message: "Item updated successfully",
      item
    });

  } catch (err) {
    console.error("UPDATE ITEM ERROR:", err);
    res.status(500).json({ message: "Failed to update item" });
  }
};

// DELETE /api/items/:id
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    await itemsModel.deleteItem(id);

    res.json({
      message: "Item removed successfully"
    });

  } catch (err) {
    console.error("DELETE ITEM ERROR:", err);
    res.status(500).json({ message: "Failed to delete item" });
  }
};