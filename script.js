// ==================== КОНФИГУРАЦИЯ ====================

const API_URL = 'http://localhost:5000/api';

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================

let cart = JSON.parse(localStorage.getItem('restaurantCart')) || {};
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let authToken = localStorage.getItem('token') || null;
let currentSlide = 0;
let slideInterval;
let verifiedPhone = null;
let verificationCode = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', function() {
    // Установка минимальной даты для календаря
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }
    
    updateCartBadge();
    initSlider();
    setupCategoryListeners();
    setupAddToCartButtons();
    
    // Добавляем обработчик для формы бронирования
    setupReservationForm();
    
    if (authToken && currentUser) {
        updateUserInfo();
    }
    
    // Загружаем меню с сервера
    if (typeof loadMenuFromServer === 'function') {
        loadMenuFromServer();
    }
});

// ==================== НАСТРОЙКА ФОРМЫ БРОНИРОВАНИЯ ====================

function setupReservationForm() {
    const reservationForm = document.getElementById('reservationForm');
    if (reservationForm) {
        reservationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('📝 Форма бронирования отправлена');
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const date = document.getElementById('date').value;
            const time = document.getElementById('time').value;
            const guests = document.getElementById('guests').value;
            
            if (!name || !email || !phone || !date || !time || !guests) {
                alert('Пожалуйста, заполните все обязательные поля');
                return;
            }
            
            const submitBtn = reservationForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Отправка...';
            
            try {
                const reservationData = {
                    name: name,
                    email: email,
                    phone: phone,
                    date: date,
                    time: time,
                    guests: parseInt(guests),
                    user_id: currentUser?.id || null
                };
                
                console.log('📤 Отправка бронирования:', reservationData);
                
                const response = await fetch(`${API_URL}/reservations/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(reservationData)
                });
                
                const data = await response.json();
                console.log('📥 Ответ сервера:', data);
                
                if (!response.ok) {
                    throw new Error(data.message || 'Ошибка при бронировании');
                }
                
                alert('✅ Столик успешно забронирован! Мы свяжемся с вами для подтверждения.');
                closeReservationModal();
                reservationForm.reset();
                
            } catch (error) {
                console.error('❌ Ошибка бронирования:', error);
                alert('Ошибка: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
        
        console.log('✅ Обработчик формы бронирования добавлен');
    } else {
        console.error('❌ Форма бронирования не найдена');
    }
}

// ==================== НАСТРОЙКА КАТЕГОРИЙ ====================

function setupCategoryListeners() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const categoryId = this.dataset.category;
            switchCategory(categoryId);
        });
    });
    
    const showMoreBtn = document.getElementById('showMoreBtn');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', toggleAllCategories);
    }
}

function setupAddToCartButtons() {
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', function() {
            const dishCard = this.closest('.dish-card');
            const dishId = dishCard.dataset.id;
            const dishName = dishCard.dataset.name;
            const dishPrice = parseInt(dishCard.dataset.price);
            addToCart(dishId, dishName, dishPrice);
        });
    });
}

function switchCategory(categoryId) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.category-btn[data-category="${categoryId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('.category-container').forEach(container => {
        container.classList.remove('active');
    });
    const activeCategory = document.getElementById(`${categoryId}-category`);
    if (activeCategory) {
        activeCategory.classList.add('active');
        activeCategory.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

let allCategoriesVisible = false;

function toggleAllCategories() {
    const showMoreBtn = document.getElementById('showMoreBtn');
    const allContainers = document.querySelectorAll('.category-container');
    
    if (!allCategoriesVisible) {
        allContainers.forEach(container => {
            container.style.display = 'block';
        });
        showMoreBtn.textContent = 'Скрыть меню';
        allCategoriesVisible = true;
    } else {
        allContainers.forEach(container => {
            if (container.id !== 'breakfast-category') {
                container.style.display = 'none';
            }
        });
        showMoreBtn.textContent = 'Показать больше меню';
        allCategoriesVisible = false;
        switchCategory('breakfast');
    }
}

// ==================== АВТОРИЗАЦИЯ ====================

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    document.querySelectorAll('.auth-tab').forEach(tabEl => {
        tabEl.classList.remove('active');
    });
    
    document.getElementById(tab + 'Form').classList.add('active');
    document.querySelector(`.auth-tab[onclick="switchAuthTab('${tab}')"]`).classList.add('active');
    
    verifiedPhone = null;
    verificationCode = null;
    resetRegistrationForm();
}

async function sendVerificationCode(phone) {
    try {
        const response = await fetch(`${API_URL}/auth/send-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Ошибка отправки кода');
        }
        
        if (data.testCode) {
            verificationCode = data.testCode;
            alert(`📱 Ваш код подтверждения: ${data.testCode}`);
        }
        
        return { success: true, message: 'Код отправлен', testCode: data.testCode };
    } catch (error) {
        console.error('Send verification error:', error);
        return { success: false, message: error.message };
    }
}

async function verifyCode(phone, code) {
    try {
        const response = await fetch(`${API_URL}/auth/verify-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone, code })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Неверный код');
        }
        
        verifiedPhone = phone;
        return { success: true, message: 'Телефон подтверждён' };
    } catch (error) {
        console.error('Verify code error:', error);
        return { success: false, message: error.message };
    }
}

async function registerUser(userData) {
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Ошибка регистрации');
        }
        
        authToken = data.token;
        currentUser = data.user;
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        return { success: true, data };
    } catch (error) {
        console.error('Register error:', error);
        return { success: false, message: error.message };
    }
}

async function loginUser(phone) {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone, agreement: 'true' })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Ошибка входа');
        }
        
        authToken = data.token;
        currentUser = data.user;
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        return { success: true, data };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: error.message };
    }
}

// ==================== ОБРАБОТЧИКИ ФОРМ ====================

document.getElementById('sendCodeBtn')?.addEventListener('click', async function() {
    const phone = document.getElementById('registerPhone').value;
    const agreement = document.getElementById('registerAgreement').checked;
    
    if (!phone) {
        alert('Введите номер телефона');
        return;
    }
    if (!agreement) {
        alert('Необходимо согласие с обработкой данных');
        return;
    }
    
    this.disabled = true;
    this.textContent = 'Отправка...';
    
    const result = await sendVerificationCode(phone);
    if (result.success) {
        document.getElementById('phoneStep').style.display = 'none';
        document.getElementById('codeStep').style.display = 'block';
        document.getElementById('verifiedPhone').value = phone;
        
        if (result.testCode) {
            document.getElementById('codeHint').innerHTML = `📱 Тестовый код: <strong>${result.testCode}</strong>`;
        }
    } else {
        alert(result.message);
    }
    
    this.disabled = false;
    this.textContent = 'Получить код';
});

document.getElementById('verifyCodeBtn')?.addEventListener('click', async function() {
    const phone = document.getElementById('verifiedPhone').value;
    const code = document.getElementById('verificationCode').value;
    
    if (!code || code.length !== 6) {
        alert('Введите 6-значный код');
        return;
    }
    
    this.disabled = true;
    this.textContent = 'Проверка...';
    
    const result = await verifyCode(phone, code);
    if (result.success) {
        document.getElementById('codeStep').style.display = 'none';
        document.getElementById('registerStep').style.display = 'block';
        document.getElementById('finalPhone').value = phone;
        document.getElementById('finalCode').value = code;
    } else {
        alert(result.message);
    }
    
    this.disabled = false;
    this.textContent = 'Подтвердить код';
});

document.getElementById('completeRegisterBtn')?.addEventListener('click', async function() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const phone = document.getElementById('finalPhone').value;
    const code = document.getElementById('finalCode').value;
    const birthDate = document.getElementById('registerBirthDate').value || null;
    
    if (!name || !email || !password) {
        alert('Заполните все обязательные поля');
        return;
    }
    if (password.length < 6) {
        alert('Пароль должен быть минимум 6 символов');
        return;
    }
    
    this.disabled = true;
    this.textContent = 'Регистрация...';
    
    const result = await registerUser({
        name,
        email,
        phone,
        password,
        birthDate,
        verificationCode: code
    });
    
    if (result.success) {
        alert('Регистрация успешна!');
        closeAuthModal();
        openAccountModal();
        resetRegistrationForm();
    } else {
        alert(result.message);
    }
    
    this.disabled = false;
    this.textContent = 'Зарегистрироваться';
});

document.getElementById('loginBtn')?.addEventListener('click', async function() {
    const phone = document.getElementById('loginPhone').value;
    const agreement = document.getElementById('loginAgreement').checked;
    
    if (!phone) {
        alert('Введите номер телефона');
        return;
    }
    if (!agreement) {
        alert('Необходимо согласие с обработкой данных');
        return;
    }
    
    this.disabled = true;
    this.textContent = 'Вход...';
    
    const result = await loginUser(phone);
    if (result.success) {
        alert('Вход выполнен успешно');
        closeAuthModal();
        openAccountModal();
        document.getElementById('loginPhone').value = '';
        document.getElementById('loginAgreement').checked = false;
    } else {
        alert(result.message);
    }
    
    this.disabled = false;
    this.textContent = 'Войти';
});

function resetRegistrationForm() {
    document.getElementById('phoneStep').style.display = 'block';
    document.getElementById('codeStep').style.display = 'none';
    document.getElementById('registerStep').style.display = 'none';
    document.getElementById('registerPhone').value = '';
    document.getElementById('verificationCode').value = '';
    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerBirthDate').value = '';
    document.getElementById('registerAgreement').checked = false;
    document.getElementById('codeHint').innerHTML = '';
    verifiedPhone = null;
    verificationCode = null;
}

// ==================== КОРЗИНА ====================

function addToCart(dishId, dishName, dishPrice) {
    console.log('Добавление товара:', dishId, dishName, dishPrice);
    
    if (!cart[dishId]) {
        cart[dishId] = {
            name: dishName,
            price: dishPrice,
            quantity: 1
        };
    } else {
        cart[dishId].quantity++;
    }
    
    localStorage.setItem('restaurantCart', JSON.stringify(cart));
    updateCartBadge();
    
    const cartModal = document.getElementById('cartModal');
    if (cartModal && cartModal.style.display === 'flex') {
        updateCartModal();
    }
    
    showNotification(`${dishName} добавлен в корзину`);
}

function updateCartBadge() {
    const cartBadge = document.getElementById('cartBadge');
    if (!cartBadge) return;
    
    let totalItems = 0;
    for (const id in cart) {
        totalItems += cart[id].quantity;
    }
    cartBadge.textContent = totalItems;
}

function updateCartModal() {
    console.log('Обновление корзины');
    
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    const cartTotal = document.getElementById('cartTotal');
    
    if (!cartItemsContainer) return;
    
    cartItemsContainer.innerHTML = '';
    let total = 0;
    let hasItems = false;
    
    for (const id in cart) {
        const item = cart[id];
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        hasItems = true;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${item.price} ₽ × ${item.quantity} = ${itemTotal} ₽</div>
            </div>
            <div class="cart-item-controls">
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="updateQuantity('${id}', -1)">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity('${id}', 1)">+</button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    }
    
    if (!hasItems) {
        cartItemsContainer.appendChild(emptyCartMessage);
        emptyCartMessage.style.display = 'block';
    } else {
        emptyCartMessage.style.display = 'none';
    }
    
    cartTotal.textContent = `${total} ₽`;
}

function updateQuantity(dishId, change) {
    console.log('Изменение количества:', dishId, change);
    
    if (cart[dishId]) {
        cart[dishId].quantity += change;
        if (cart[dishId].quantity <= 0) {
            delete cart[dishId];
        }
        localStorage.setItem('restaurantCart', JSON.stringify(cart));
        updateCartBadge();
        updateCartModal();
    }
}

function clearCart() {
    if (Object.keys(cart).length === 0) {
        alert('Корзина уже пуста!');
        return;
    }
    if (confirm('Вы уверены, что хотите очистить корзину?')) {
        cart = {};
        localStorage.removeItem('restaurantCart');
        updateCartBadge();
        updateCartModal();
    }
}

function calculateCartTotal() {
    let total = 0;
    for (const id in cart) {
        total += cart[id].price * cart[id].quantity;
    }
    return total;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '70px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#ffca47';
    notification.style.color = '#7D1212';
    notification.style.padding = '15px 20px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '9999';
    notification.style.fontWeight = 'bold';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.animation = 'slideIn 0.3s ease, slideOut 0.3s ease 2.7s';
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// ==================== ЗАКАЗЫ ====================

async function createOrder() {
    try {
        console.log('Начинаем создание заказа');
        
        if (!currentUser) {
            alert('Для оформления заказа необходимо войти в систему');
            openAuthModal();
            return false;
        }
        
        const cartData = JSON.parse(localStorage.getItem('restaurantCart') || '{}');
        console.log('Корзина:', cartData);
        
        const itemsCount = Object.keys(cartData).length;
        if (itemsCount === 0) {
            alert('Корзина пуста');
            return false;
        }
        
        const deliveryDelivery = document.getElementById('deliveryDelivery')?.checked || false;
        const deliveryStreet = document.getElementById('deliveryStreet')?.value || '';
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'card';
        const deliveryComment = document.getElementById('deliveryComment')?.value || '';
        
        if (deliveryDelivery && !deliveryStreet.trim()) {
            alert('Пожалуйста, укажите адрес доставки');
            return false;
        }
        
        let totalAmount = 0;
        const items = [];
        
        for (const dishId in cartData) {
            const item = cartData[dishId];
            const itemTotal = item.price * item.quantity;
            totalAmount += itemTotal;
            
            items.push({
                dish_id: parseInt(dishId),
                dish_name: item.name,
                price: item.price,
                quantity: item.quantity,
                total: itemTotal
            });
        }
        
        console.log('Сумма заказа:', totalAmount);
        console.log('Товары:', items);
        
        let deliveryAddress = null;
        if (deliveryDelivery) {
            deliveryAddress = JSON.stringify({
                city: 'Нефтеюганск',
                street: deliveryStreet,
                comment: deliveryComment
            });
        }
        
        const orderData = {
            items: items,
            total_amount: totalAmount,
            delivery_type: deliveryDelivery ? 'delivery' : 'pickup',
            delivery_address: deliveryAddress,
            payment_method: paymentMethod,
            comment: deliveryComment
        };
        
        console.log('Отправка на сервер:', orderData);
        
        const response = await fetch(`${API_URL}/orders/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(orderData)
        });
        
        const data = await response.json();
        console.log('Ответ сервера:', data);
        
        if (!response.ok) {
            throw new Error(data.message || 'Ошибка создания заказа');
        }
        
        // ✅ Очищаем корзину
        cart = {};
        localStorage.removeItem('restaurantCart');
        updateCartBadge();
        
        alert(`✅ Заказ #${data.order_number} успешно оформлен!`);
        closeCheckoutModal();
        
        const orderSuccess = document.getElementById('orderSuccess');
        const orderNumber = document.getElementById('orderNumber');
        if (orderSuccess && orderNumber) {
            orderNumber.textContent = data.order_number;
            document.getElementById('checkoutForm').style.display = 'none';
            orderSuccess.style.display = 'block';
        }
        
        return true;
        
    } catch (error) {
        console.error('Ошибка заказа:', error);
        alert('❌ ' + error.message);
        return false;
    }
}

function openCheckoutModal() {
    console.log('Открытие окна оформления');
    
    const itemsCount = Object.keys(cart).length;
    if (itemsCount === 0) {
        alert('Корзина пуста! Добавьте товары.');
        return;
    }
    
    if (!currentUser) {
        alert('Необходимо войти в систему');
        openAuthModal();
        return;
    }
    
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;
    
    const checkoutItems = document.getElementById('checkoutItems');
    if (checkoutItems) {
        checkoutItems.innerHTML = '';
        let total = 0;
        
        for (const id in cart) {
            const item = cart[id];
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            
            const element = document.createElement('div');
            element.className = 'checkout-item';
            element.innerHTML = `
                <span>${item.name} × ${item.quantity}</span>
                <span>${itemTotal} ₽</span>
            `;
            checkoutItems.appendChild(element);
        }
        
        const checkoutTotal = document.getElementById('checkoutTotal');
        if (checkoutTotal) {
            checkoutTotal.textContent = `${total} ₽`;
        }
    }
    
    document.getElementById('deliveryPickup').checked = true;
    document.getElementById('deliveryStreet').value = '';
    document.getElementById('deliveryAddressFields').classList.remove('active');
    document.getElementById('checkoutForm').style.display = 'block';
    document.getElementById('orderSuccess').style.display = 'none';
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function toggleDeliveryAddress() {
    const fields = document.getElementById('deliveryAddressFields');
    const delivery = document.getElementById('deliveryDelivery');
    if (fields && delivery) {
        fields.classList.toggle('active', delivery.checked);
    }
}

function proceedToPayment() {
    createOrder();
}

// ==================== ЗАГРУЗКА ЗАКАЗОВ С СЕРВЕРА ====================

async function loadUserOrdersFromServer() {
    if (!currentUser || !authToken) {
        console.log('Нет авторизации для загрузки заказов');
        return [];
    }
    
    try {
        const response = await fetch(`${API_URL}/users/orders`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки заказов');
        }
        
        const orders = await response.json();
        console.log('Заказы с сервера:', orders);
        return orders;
        
    } catch (error) {
        console.error('Ошибка загрузки заказов с сервера:', error);
        return [];
    }
}

function getOrderStatusText(status) {
    const statusMap = {
        'processing': 'В обработке',
        'approved': 'Одобрен',
        'delivery': 'Доставка',
        'completed': 'Завершен',
        'cancelled_by_manager': 'Отменен менеджером',
        'cancelled_by_customer': 'Отменен клиентом'
    };
    return statusMap[status] || status || 'В обработке';
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================

function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        resetRegistrationForm();
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        resetRegistrationForm();
    }
}

function openAccountModal() {
    if (currentUser) {
        const modal = document.getElementById('accountModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            updateAccountModal();
        }
    } else {
        openAuthModal();
    }
}

function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function openCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        updateCartModal();
    }
}

function closeCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function openReservationModal() {
    const modal = document.getElementById('reservationModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeReservationModal() {
    const modal = document.getElementById('reservationModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function openMainMenuModal() {
    const modal = document.getElementById('mainMenuModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeMainMenuModal() {
    const modal = document.getElementById('mainMenuModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function openBarMenuModal() {
    const modal = document.getElementById('barMenuModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeBarMenuModal() {
    const modal = document.getElementById('barMenuModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    }
}

// ==================== ЛИЧНЫЙ КАБИНЕТ ====================

async function updateAccountModal() {
    if (!currentUser) return;
    
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.innerHTML = `
            <p><strong>Имя:</strong> ${currentUser.name || 'Не указано'}</p>
            <p><strong>Email:</strong> ${currentUser.email || 'Не указан'}</p>
            <p><strong>Телефон:</strong> ${currentUser.phone || 'Не указан'}</p>
            <p><strong>Дата рождения:</strong> ${currentUser.birthDate || 'Не указана'}</p>
        `;
    }
    
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    
    ordersList.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">Загрузка заказов...</div>';
    
    const orders = await loadUserOrdersFromServer();
    
    ordersList.innerHTML = '';
    
    if (orders.length === 0) {
        ordersList.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">У вас еще нет заказов</div>';
    } else {
        orders.forEach(order => {
            const orderItem = document.createElement('div');
            orderItem.className = 'order-item';
            orderItem.onclick = () => showOrderDetails(order);
            
            let itemsCount = 0;
            if (order.items && order.items !== null) {
                if (typeof order.items === 'string') {
                    try {
                        const parsed = JSON.parse(order.items);
                        itemsCount = Array.isArray(parsed) ? parsed.length : 1;
                    } catch(e) {
                        itemsCount = 1;
                    }
                } else if (Array.isArray(order.items)) {
                    itemsCount = order.items.length;
                }
            }
            
            orderItem.innerHTML = `
                <div class="order-header">
                    <span class="order-number">Заказ #${order.order_number || order.id}</span>
                    <span class="order-date">${new Date(order.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
                <div style="margin-top: 10px;">
                    Сумма: ${Number(order.total_amount).toLocaleString('ru-RU')} ₽<br>
                    Статус: <span style="color: #ffca47;">${getOrderStatusText(order.order_status)}</span>
                </div>
                <div style="margin-top: 5px; font-size: 0.9em; color: #aaa;">
                    ${itemsCount} товаров
                </div>
            `;
            ordersList.appendChild(orderItem);
        });
    }
}

function showOrderDetails(order) {
    let itemsText = '';
    let items = order.items;
    
    if (typeof items === 'string' && items) {
        try {
            items = JSON.parse(items);
        } catch(e) {
            items = [];
        }
    }
    
    if (items && Array.isArray(items)) {
        itemsText = items.map(item => 
            `• ${item.dish_name} x${item.quantity} = ${Number(item.total || item.dish_price * item.quantity).toLocaleString('ru-RU')} ₽`
        ).join('\n');
    } else {
        itemsText = 'Нет информации о товарах';
    }
    
    alert(`
        Заказ #${order.order_number || order.id}
        Дата: ${new Date(order.created_at).toLocaleString('ru-RU')}
        Сумма: ${Number(order.total_amount).toLocaleString('ru-RU')} ₽
        Способ: ${order.delivery_type === 'delivery' ? '🚚 Доставка' : '🏬 Самовывоз'}
        Статус: ${getOrderStatusText(order.order_status)}
        
        Состав заказа:
        ${itemsText}
    `);
}

function toggleEditForm() {
    const editForm = document.getElementById('editForm');
    if (editForm) {
        const isActive = editForm.classList.contains('active');
        if (!isActive && currentUser) {
            document.getElementById('editName').value = currentUser.name || '';
            document.getElementById('editEmail').value = currentUser.email || '';
            document.getElementById('editPhone').value = currentUser.phone || '';
            document.getElementById('editBirthDate').value = currentUser.birthDate || '';
        }
        editForm.classList.toggle('active');
    }
}

function saveUserInfo() {
    const name = document.getElementById('editName').value;
    const email = document.getElementById('editEmail').value;
    const phone = document.getElementById('editPhone').value;
    const birthDate = document.getElementById('editBirthDate').value;
    
    if (!name || !email || !phone) {
        alert('Заполните обязательные поля: Имя, Email, Телефон');
        return;
    }
    
    currentUser.name = name;
    currentUser.email = email;
    currentUser.phone = phone;
    currentUser.birthDate = birthDate;
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    toggleEditForm();
    updateAccountModal();
    showNotification('Информация сохранена');
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        currentUser = null;
        authToken = null;
        
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        
        closeAccountModal();
        showNotification('Вы вышли из аккаунта');
    }
}

// ==================== СЛАЙДЕР ====================

function initSlider() {
    const slides = document.querySelectorAll('.slider-slide');
    const dots = document.querySelectorAll('.slider-dot');
    const prevBtn = document.querySelector('.slider-prev');
    const nextBtn = document.querySelector('.slider-next');
    
    if (slides.length === 0) return;
    
    let currentSlide = 0;
    const totalSlides = slides.length;
    
    function updateSlider() {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }
    
    function nextSlide() {
        currentSlide = (currentSlide + 1) % totalSlides;
        updateSlider();
    }
    
    function prevSlide() {
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        updateSlider();
    }
    
    let slideInterval = setInterval(nextSlide, 5000);
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextSlide();
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, 5000);
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevSlide();
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, 5000);
        });
    }
    
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSlide = index;
            updateSlider();
            clearInterval(slideInterval);
            slideInterval = setInterval(nextSlide, 5000);
        });
    });
    
    const slider = document.querySelector('.gallery-slider');
    if (slider) {
        slider.addEventListener('mouseenter', () => clearInterval(slideInterval));
        slider.addEventListener('mouseleave', () => {
            slideInterval = setInterval(nextSlide, 5000);
        });
    }
    
    updateSlider();
}

// ==================== ОБРАБОТЧИКИ ДЛЯ ЗАКРЫТИЯ МОДАЛОК ====================

window.onclick = function(event) {
    const modals = [
        'reservationModal',
        'mainMenuModal',
        'barMenuModal',
        'cartModal',
        'authModal',
        'accountModal',
        'checkoutModal'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target == modal) {
            if (modalId === 'reservationModal') closeReservationModal();
            if (modalId === 'mainMenuModal') closeMainMenuModal();
            if (modalId === 'barMenuModal') closeBarMenuModal();
            if (modalId === 'cartModal') closeCartModal();
            if (modalId === 'authModal') closeAuthModal();
            if (modalId === 'accountModal') closeAccountModal();
            if (modalId === 'checkoutModal') closeCheckoutModal();
        }
    });
    
    const overlay = document.getElementById('overlay');
    if (event.target == overlay) {
        toggleSidebar();
    }
};

// Заглушки для функций (чтобы не было ошибок)
async function loadUserOrders() {
    return loadUserOrdersFromServer();
}

function updateUserInfo() {
    return Promise.resolve();
}