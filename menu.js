// ==================== ЗАГРУЗКА МЕНЮ С СЕРВЕРА ====================

async function loadMenuFromServer() {
    try {
        const response = await fetch(`${API_URL}/dishes`);
        if (!response.ok) throw new Error('Ошибка загрузки меню');
        
        const dishes = await response.json();
        console.log('Загруженные блюда:', dishes);
        
        // Группируем блюда по категориям
        const dishesByCategory = {};
        dishes.forEach(dish => {
            const categorySlug = getCategorySlug(dish.category_id);
            if (!dishesByCategory[categorySlug]) {
                dishesByCategory[categorySlug] = [];
            }
            dishesByCategory[categorySlug].push(dish);
        });
        
        // Обновляем каждую категорию
        updateCategoryContainer('breakfast', dishesByCategory['breakfast'] || []);
        updateCategoryContainer('hot', dishesByCategory['hot'] || []);
        updateCategoryContainer('soups', dishesByCategory['soups'] || []);
        updateCategoryContainer('pizza', dishesByCategory['pizza'] || []);
        updateCategoryContainer('salads', dishesByCategory['salads'] || []);
        updateCategoryContainer('desserts', dishesByCategory['desserts'] || []);
        updateCategoryContainer('drinks', dishesByCategory['drinks'] || []);
        
    } catch (error) {
        console.error('Ошибка загрузки меню:', error);
    }
}

function getCategorySlug(categoryId) {
    const categories = {
        1: 'breakfast',
        2: 'hot',
        3: 'soups',
        4: 'pizza',
        5: 'salads',
        6: 'desserts',
        7: 'drinks'
    };
    return categories[categoryId] || 'other';
}

function updateCategoryContainer(categoryId, dishes) {
    const container = document.getElementById(`${categoryId}-category`);
    if (!container) return;
    
    const dishesGrid = container.querySelector('.dishes-grid');
    if (!dishesGrid) return;
    
    if (dishes.length === 0) {
        dishesGrid.innerHTML = '<div style="text-align: center; padding: 40px; color: #888;">В этой категории пока нет блюд</div>';
        return;
    }
    
    dishesGrid.innerHTML = dishes.map(dish => createDishCard(dish)).join('');
    
    // Переназначаем обработчики для новых кнопок
    dishesGrid.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', function() {
            const dishCard = this.closest('.dish-card');
            const dishId = dishCard.dataset.id;
            const dishName = dishCard.dataset.name;
            const dishPrice = parseInt(dishCard.dataset.price);
            
            // Используем существующую функцию addToCart из script.js
            if (typeof addToCart === 'function') {
                addToCart(dishId, dishName, dishPrice);
            }
        });
    });
}

function createDishCard(dish) {
    return `
        <div class="dish-card" data-id="${dish.id}" data-name="${dish.name}" data-price="${dish.price}">
            <img src="${dish.image_url || 'placeholder.jpg'}" alt="${dish.name}" class="dish-image">
            <div class="dish-info">
                <div class="dish-name">${dish.name}</div>
                <div class="dish-composition">${dish.description || dish.composition || ''}</div>
                <div class="dish-weight">${dish.weight || ''}</div>
                <div class="dish-footer">
                    <div class="dish-price">${dish.price} ₽</div>
                    <button class="add-to-cart-btn">В корзину</button>
                </div>
            </div>
        </div>
    `;
}