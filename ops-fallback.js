const previousCreateOrReuseIngredient = createOrReuseIngredient;
createOrReuseIngredient = async function createOrReuseIngredientFallback({ name, unit, cost }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return null;
  const existingId = ingredientKeyByName(cleanName);
  if (existingId) return existingId;

  const item = { name: cleanName, unit: unit || 'g', current: Number(cost) || 0, before: Number(cost) || 0 };
  if (useSupabase && session && supabase) {
    let result = await supabase.from('ingredients').insert({ business_id: businessId, name: item.name, normalized_name: normalizeProductName(item.name), unit: item.unit, current_cost: item.current, previous_cost: item.before }).select('id').single();
    if (result.error) {
      result = await supabase.from('ingredients').insert({ business_id: businessId, name: item.name, unit: item.unit, current_cost: item.current, previous_cost: item.before }).select('id').single();
    }
    if (result.error) {
      const fallbackId = ingredientKeyByName(cleanName);
      if (fallbackId) return fallbackId;
      showSync?.(result.error.message);
      return null;
    }
    ingredients[result.data.id] = item;
    return result.data.id;
  }

  const id = slugify(cleanName);
  ingredients[id] = item;
  return id;
};
