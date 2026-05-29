async function updateDishWithFormats(dish) {
  if (!useSupabase || !session || !supabase || !dish) return;
  const payload = {
    servings: dish.servings,
    pvp: dish.pvp,
    yield_unit: 'tapas_base',
    sale_formats: ensureDishFormats(dish),
  };
  const { error } = await supabase.from('dishes').update(payload).eq('id', dish.id);
  if (!error) return;
  await supabase.from('dishes').update({ servings: dish.servings, pvp: dish.pvp }).eq('id', dish.id);
}

loadFromSupabase = async function loadFromSupabaseWithFormats() {
  const { data: biz, error: bizError } = await supabase.from('businesses').select('id,name,slug,target_margin').limit(1).single();
  if (bizError) throw bizError;
  businessId = biz.id;
  business = { ...business, name: biz.name, slug: biz.slug, targetMargin: Number(biz.target_margin) };

  const { data: ing, error: ingError } = await supabase.from('ingredients').select('id,name,unit,current_cost,previous_cost').eq('business_id', businessId).order('name');
  if (ingError) throw ingError;
  ingredients = Object.fromEntries(ing.map((item) => [item.id, { name: item.name, unit: item.unit, current: Number(item.current_cost), before: Number(item.previous_cost ?? item.current_cost) }]));

  let dishResult = await supabase.from('dishes').select('id,name,category,servings,pvp,published,description,allergens,image_key,yield_unit,sale_formats,dish_ingredients(quantity,sort_order,ingredient_id)').eq('business_id', businessId).order('created_at');
  if (dishResult.error) {
    dishResult = await supabase.from('dishes').select('id,name,category,servings,pvp,published,description,allergens,image_key,dish_ingredients(quantity,sort_order,ingredient_id)').eq('business_id', businessId).order('created_at');
  }
  if (dishResult.error) throw dishResult.error;

  dishes = dishResult.data.map((dish) => {
    const mapped = {
      id: dish.id,
      name: dish.name,
      category: dish.category,
      servings: Number(dish.servings),
      pvp: Number(dish.pvp),
      icon: dish.image_key || 'olive-thumb',
      published: dish.published,
      description: dish.description || '',
      allergens: dish.allergens || '',
      yieldUnit: dish.yield_unit || 'tapas_base',
      recipe: [...(dish.dish_ingredients || [])].sort((a, b) => a.sort_order - b.sort_order).map((line) => ({ ingredient: line.ingredient_id, qty: Number(line.quantity) })),
    };
    mapped.formats = Array.isArray(dish.sale_formats) && dish.sale_formats.length
      ? dish.sale_formats.map((format) => ({ id: format.id, name: format.name, portions: Number(format.portions) || 1, pvp: roundMoney(format.pvp) }))
      : defaultFormats(mapped);
    if (mapped.formats[0] && !mapped.formats[0].pvp) mapped.formats[0].pvp = mapped.pvp;
    mapped.pvp = primaryFormat(mapped).pvp;
    return mapped;
  });
  selectedDishId = dishes.some((dish) => dish.id === selectedDishId) ? selectedDishId : dishes[0]?.id;
};

saveRecipeQuantities = async function saveRecipeQuantitiesWithFormats() {
  const dish = selectedDish?.();
  if (!dish) return;
  dish.recipe = [...document.querySelectorAll('[data-recipe-index]')].map((input) => {
    const index = Number(input.dataset.recipeIndex);
    const ingredientInput = document.querySelector(`[data-recipe-ingredient="${index}"]`);
    return { ingredient: ingredientInput?.value, qty: Math.max(numberFromInput(input.value, dish.recipe[index]?.qty || 1), 0.0001) };
  }).filter((line) => line.ingredient);
  applyFormatChanges(dish);

  if (useSupabase && session && supabase) {
    await updateDishWithFormats(dish);
    await supabase.from('dish_ingredients').delete().eq('dish_id', dish.id);
    if (dish.recipe.length) {
      await supabase.from('dish_ingredients').insert(dish.recipe.map((line, index) => ({ dish_id: dish.id, ingredient_id: line.ingredient, quantity: line.qty, sort_order: index })));
    }
    await loadFromSupabase();
  }
  renderAll();
  renderRecipeEditor();
  showSync?.('Receta, rendimiento y formatos actualizados');
};

applyRecommendedPrice = async function applyRecommendedPriceWithFormats() {
  // Deprecated/delegation candidate: apply-price-action.js is the planned owner
  // for the full apply recommended price flow.
  if (typeof applyRecommendedPriceFromCurrentContext === 'function') {
    return applyRecommendedPriceFromCurrentContext();
  }
  const dish = oilAlert().affected[0]?.dish || selectedDish();
  if (!dish) return;
  ensureDishFormats(dish);
  dish.formats[0].pvp = suggestedPrice(dish, business.targetMargin, dish.formats[0]);
  dish.pvp = dish.formats[0].pvp;
  selectedDishId = dish.id;
  if (useSupabase && session) await updateDishWithFormats(dish);
  renderAll();
  showSync('Precio actualizado');
};
