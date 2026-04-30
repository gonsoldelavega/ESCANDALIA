document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.textContent.trim() !== 'Editar manualmente') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const dish = oilAlert().affected[0]?.dish || selectedDish?.();
  if (dish?.id) selectedDishId = dish.id;
  showScreen('edit-recipe');
  setTimeout(() => {
    document.querySelector('.format-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showSync?.('Edita el rendimiento o el PVP para corregir el precio');
  }, 120);
}, true);
