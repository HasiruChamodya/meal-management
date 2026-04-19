  const recipesModel = require("../models/recipesModel");
  const { writeAudit } = require("../utils/audit");

  // GET /api/recipes
  exports.getRecipes = async (req, res) => {
    try {
      const recipes = await recipesModel.getRecipes();
      res.status(200).json({ recipes });
    } catch (error) {
      console.error("GET RECIPES ERROR:", error);
      res.status(500).json({ message: "Failed to fetch recipes" });
    }
  };

  // POST /api/recipes
  exports.createRecipe = async (req, res) => {
    try {
      const { recipeKey, name } = req.body;

      if (!recipeKey || !name) {
        return res.status(400).json({ message: "recipeKey and name are required" });
      }

      const recipe = await recipesModel.createRecipe({ recipeKey, name });

      await writeAudit({
        req,
        action: "CREATE_RECIPE",
        entity: "recipes",
        entity_id: String(recipe.id),
        new_value: recipe,
        details: { message: "Recipe created successfully" },
        severity: "info",
        status_code: 201,
        success: true,
      });

      res.status(201).json({
        message: "Recipe created successfully",
        recipe,
      });
    } catch (error) {
      console.error("CREATE RECIPE ERROR:", error);
      res.status(500).json({ message: "Failed to create recipe" });
    }
  };

  // PUT /api/recipes/:id
  exports.updateRecipe = async (req, res) => {
    try {
      const { id } = req.params;
      const { recipeKey, name } = req.body;

      if (!recipeKey || !name) {
        return res.status(400).json({ message: "recipeKey and name are required" });
      }

      const oldRecipe = await recipesModel.getRecipeById(id);
      if (!oldRecipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }

      const recipe = await recipesModel.updateRecipe(id, { recipeKey, name });

      await writeAudit({
        req,
        action: "UPDATE_RECIPE",
        entity: "recipes",
        entity_id: String(id),
        old_value: oldRecipe,
        new_value: recipe,
        details: { message: "Recipe updated successfully" },
        severity: "info",
        status_code: 200,
        success: true,
      });

      res.status(200).json({
        message: "Recipe updated successfully",
        recipe,
      });
    } catch (error) {
      console.error("UPDATE RECIPE ERROR:", error);
      res.status(500).json({ message: "Failed to update recipe" });
    }
  };

  // DELETE /api/recipes/:id
  exports.getRecipeIngredients = async (req, res) => {
    try {
      const { recipeId } = req.params;
      const ingredients = await recipesModel.getRecipeIngredients(recipeId);
      res.status(200).json({ ingredients });
    } catch (error) {
      console.error("GET RECIPE INGREDIENTS ERROR:", error);
      res.status(500).json({ message: "Failed to fetch recipe ingredients" });
    }
  };

  // DELETE /api/recipes/:id
  exports.addRecipeIngredient = async (req, res) => {
    try {
      const { recipeId } = req.params;
      const { itemId, normPerPatient, unit } = req.body;

      if (!itemId || normPerPatient === undefined || !unit) {
        return res.status(400).json({
          message: "itemId, normPerPatient and unit are required",
        });
      }

      const ingredient = await recipesModel.addRecipeIngredient({
        recipeId,
        itemId,
        normPerPatient,
        unit,
      });

      await writeAudit({
        req,
        action: "ADD_RECIPE_INGREDIENT",
        entity: "recipe_ingredients",
        entity_id: String(ingredient.id),
        new_value: ingredient,
        details: { recipeId },
        severity: "info",
        status_code: 201,
        success: true,
      });

      res.status(201).json({
        message: "Ingredient added successfully",
        ingredient,
      });
    } catch (error) {
      console.error("ADD RECIPE INGREDIENT ERROR:", error);
      res.status(500).json({ message: "Failed to add recipe ingredient" });
    }
  };

  // PUT /api/recipes/ingredients/:id
  exports.updateRecipeIngredient = async (req, res) => {
    try {
      const { id } = req.params;
      const { normPerPatient, unit } = req.body;

      if (normPerPatient === undefined || !unit) {
        return res.status(400).json({
          message: "normPerPatient and unit are required",
        });
      }

      const ingredient = await recipesModel.updateRecipeIngredient(id, {
        normPerPatient,
        unit,
      });

      if (!ingredient) {
        return res.status(404).json({ message: "Recipe ingredient not found" });
      }

      await writeAudit({
        req,
        action: "UPDATE_RECIPE_INGREDIENT",
        entity: "recipe_ingredients",
        entity_id: String(id),
        new_value: ingredient,
        details: { message: "Ingredient updated successfully" },
        severity: "info",
        status_code: 200,
        success: true,
      });

      res.status(200).json({
        message: "Ingredient updated successfully",
        ingredient,
      });
    } catch (error) {
      console.error("UPDATE RECIPE INGREDIENT ERROR:", error);
      res.status(500).json({ message: "Failed to update recipe ingredient" });
    }
  };

  // DELETE /api/recipes/ingredients/:id
  exports.deleteRecipeIngredient = async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await recipesModel.deleteRecipeIngredient(id);

      if (!deleted) {
        return res.status(404).json({ message: "Recipe ingredient not found" });
      }

      await writeAudit({
        req,
        action: "DELETE_RECIPE_INGREDIENT",
        entity: "recipe_ingredients",
        entity_id: String(id),
        old_value: deleted,
        details: { message: "Ingredient removed successfully" },
        severity: "security",
        status_code: 200,
        success: true,
      });

      res.status(200).json({ message: "Ingredient removed successfully" });
    } catch (error) {
      console.error("DELETE RECIPE INGREDIENT ERROR:", error);
      res.status(500).json({ message: "Failed to remove recipe ingredient" });
    }
  };

  // GET /api/recipes/available-items
  exports.getAvailableItems = async (req, res) => {
    try {
      const items = await recipesModel.getAvailableItems();
      res.status(200).json({ items });
    } catch (error) {
      console.error("GET AVAILABLE ITEMS ERROR:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  };